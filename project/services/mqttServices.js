// mqttHandler.js
const mqtt = require('mqtt');
const axios = require('axios');
const Device = require('../models/Device');
const SensorData = require('../models/data');
const Automation = require('../models/auto');
const PowerLog = require('../models/powerlog');
const AutomationLog = require('../models/autolog');
const cron = require('node-cron');
const moment = require('moment-timezone');
const { verifyToken } = require('../utils/token');
const { registerDevice } = require('../services/deviceServices');
const mongoose = require('mongoose'); 

const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

const subscribedDevices = new Set();
const connectedClients = new Map();
const recentPowerLogs = new Map();
const pendingPowerUpdates = new Map();
const recentAutomationLogs = new Map();
let powerLogCallCount = 0;
let teleSensorDebounceTimer = null;

////////////////////////////////////

async function ensureIndexes() {
  try {
    await PowerLog.collection.createIndex({ clientId: 1, power: 1, timestamp: -1 });
    console.log('PowerLog indexes ensured');
  } catch (err) {
    console.error('Error ensuring indexes:', err);
  }
}
ensureIndexes();

////////////////////////////////////////////////////////////////////////

function sendHttpEvent(endpoint, payload = { status: 'Connected' }) {
  axios.post(`http://192.168.1.168:3001/${endpoint}`, payload, {
    headers: { 'Content-Type': 'application/json' },
  }).then(() => {
    console.log(`➡️ Sent ${endpoint} to HTTP server`);
  }).catch((err) => {
    console.error(`❌ Failed to send ${endpoint}:`, err.message);
  });
}

///////////////////////////////////////////////////////////////////

async function logDeviceStatus(clientId, entity, power, status) {
  try {
    const filter = { clientId, entity };
    const update = { power, status, lastSeen: new Date() };
    const result = await Device.updateOne(filter, { $set: update });
    if (result.matchedCount === 0) {
      console.warn(`⚠️ Device not found for clientId=${clientId}, entity=${entity}`);
    }
  } catch (err) {
    console.error(`❌ Failed to update device status for ${clientId}:${entity}:`, err.message);
  }
}

///////////////////////////////////////////////////////////////

async function logPowerStatus({ clientId, entity, power }) {
  powerLogCallCount++;
  console.log(`logPowerStatus called ${powerLogCallCount} times for ${clientId}:${entity} with power=${power}`);
  if (!['ON', 'OFF'].includes(power)) return;

  const now = Date.now();
  const key = `${clientId}_${entity}`;
  const last = recentPowerLogs.get(key);

  if (last && last.power === power && now - last.ts < 1000) {
    console.log(`🚑 Skipping duplicate power log for ${clientId}:${entity}, power=${power}`);
    return;
  }

  try {
    await PowerLog.create({ clientId, entity, power, timestamp: new Date() });
    recentPowerLogs.set(key, { power, ts: now });
    console.log(`✅ PowerLog saved: ${clientId}:${entity}, ${power}`);
  } catch (err) {
    console.error(`Power log error for ${clientId}:${entity}:`, err);
  }
}

///////////////////////////////////////////////////////////

async function logAutomationExecution({ ruleId, action }) {
  const key = `${ruleId}_${action}`;
  const now = Date.now();
  const last = recentAutomationLogs.get(key);

  if (last && now - last < 5000) {
    console.log(`🚑 Skipping duplicate AutomationLog for ${key}`);
    return;
  }

  try {
    await AutomationLog.create({ ruleId, action, timestamp: new Date() });
    recentAutomationLogs.set(key, now);
    console.log(`✅ AutomationLog saved: ${key}`);
  } catch (err) {
    console.error(`❌ Failed to log automation execution:`, err.message);
  }
}

//////////////////////////////////////

function subscribeToTopic(topic) {
  if (subscribedDevices.has(topic)) return;
  client.subscribe(topic, (err) => {
    if (!err) {
      subscribedDevices.add(topic);
      console.log(`Subscribed to topic: ${topic}`);
    } else {
      console.error(`Failed to subscribe topic ${topic}:`, err.message);
    }
  });
}

//////////////////////////////////

client.on('connect', () => {
  sendHttpEvent('connection');
  console.log('MQTT connected');

  ['tele/+/STATE', 'tele/+/LWT', 'tele/+/SENSOR', 'stat/+/RESULT', 'stat/+/POWER']
    .forEach(subscribeToTopic);
});

/////////////////////////////////////////////////////////

client.on('message', async (topic, message, packet) => {
  const msgStr = message.toString();
  let payload;
  try { payload = JSON.parse(msgStr); } catch { payload = {}; }

  const stateMatch = topic.match(/^tele\/(.+?)\/STATE$/);
  const lwtMatch = topic.match(/^tele\/(.+?)\/LWT$/);
  const resultMatch = topic.match(/^stat\/(.+?)\/RESULT$/);
  const powerMatch = topic.match(/^stat\/(.+?)\/POWER$/);
  const sensorMatch = topic.match(/^tele\/(.+?)\/SENSOR$/);

  const clientId = stateMatch?.[1] || lwtMatch?.[1] || resultMatch?.[1] || powerMatch?.[1] || sensorMatch?.[1];
  if (!clientId) return;

  let type;
  if (clientId.startsWith('VIOT_')) type = 'th';
  else if (clientId.startsWith('tasmota_')) type = 'bridge';
  else if (clientId.startsWith('sonoff_')) type = 'sonoff';
  else if (packet?.username?.includes('_')) {
    type = packet.username.split('_')[1]?.toLowerCase();
  }

  if (!connectedClients.has(clientId)) {
    connectedClients.set(clientId, { type: type || null, entities: new Set() });
  } else if (!connectedClients.get(clientId).type && type) {
    connectedClients.get(clientId).type = type;
  }

  const deviceInfo = connectedClients.get(clientId);

  if (sensorMatch) {
    for (const [entity, data] of Object.entries(payload)) {
      if (entity === 'Time' || typeof data !== 'object') continue;
      deviceInfo.entities.add(entity);
      await new SensorData({ clientId, entity, data, timestamp: new Date() }).save();
    }

    if (teleSensorDebounceTimer) clearTimeout(teleSensorDebounceTimer);
    teleSensorDebounceTimer = setTimeout(async () => {
      try {
        const result = await getConnectedDevices();
        console.log(`📱 Synced ${result.count} devices after SENSOR burst`);
      } catch (err) {
        console.error('❌ Failed to sync devices:', err.message);
      }
    }, 10000);
    return;
  }

  const entity = deviceInfo.entities.values().next().value || 'main';

  if (powerMatch) {
    const powerState = msgStr === 'ON' ? 'ON' : msgStr === 'OFF' ? 'OFF' : null;
    if (powerState && !pendingPowerUpdates.has(clientId)) {
      pendingPowerUpdates.set(clientId, true);
      try {
        await logPowerStatus({ clientId, entity, power: powerState });
        await logDeviceStatus(clientId, entity, powerState, 'connected');
      } finally {
        setTimeout(() => pendingPowerUpdates.delete(clientId), 100);
      }
    }
    return;
  }

  if (resultMatch || stateMatch) {
    const powerState = payload?.POWER || payload?.POWER1 || null;
    if (powerState === 'ON' || powerState === 'OFF') {
      await logDeviceStatus(clientId, entity, powerState, 'connected');
    }
  }
});

////////////////////////////////////////////////////////////


async function getConnectedDevices() {
  const connected = Array.from(connectedClients.entries());
  const devices = [];

  for (const [clientId, info] of connected) {
    const type = info.type || null;
    const entities = Array.from(info.entities || []);

    for (const entity of entities.length > 0 ? entities : ['main']) {
      if (entity === 'main') continue; 
      const existingDevice = await Device.findOne({ clientId, entity });
      if (!existingDevice) {
        await registerDevice(clientId, entity, type);
        console.log(`📅 Registered new device: ${clientId}, entity: ${entity}, type: ${type}`);
      }
      devices.push({ clientId, entity, type });
    }
  }

  return { success: true, count: devices.length, devices };
}

////////////////////////////////////////////


cron.schedule('*/5 * * * *', async () => {
  try {
    const result = await getConnectedDevices();
    console.log(`⏰ Periodic device sync: ${result.count} devices connected.`);
  } catch (err) {
    console.error('❌ Error in periodic getConnectedDevices call:', err.message);
  }
});
/////////////////////////////////////////////////////////////////////////


async function getLatestSensorData(clientId, entity) {
  try {
    const sensor = await SensorData.findOne({ clientId, entity }).sort({ _id: -1 });
    const status = await Device.findOne({ clientId, entity }).select('power status message lastSeen');
    if (!sensor && !status) return { success: false, message: 'No data available' };
    return { success: true, data: { sensor, status } };
  } catch (err) {
    return { success: false, message: 'Error retrieving data' };
  }
}

async function sendCommand(clientId, entity) {
  try {
    const device = await Device.findOne({ clientId, entity });
    if (!device) return { success: false, message: 'No device available' };

    const inputTopic = `cmnd/${clientId}/POWER`;
    const message = 'TOGGLE';
    const responseTopic1 = `stat/${clientId}/RESULT`;
    const responseTopic2 = `stat/${clientId}/POWER`;

    return await new Promise((resolve, reject) => {
      let timeout;

      const handleMessage = async (topic, payload) => {
        if (topic === responseTopic1 || topic === responseTopic2) {
          clearTimeout(timeout);
          client.removeListener('message', handleMessage);
          client.unsubscribe([responseTopic1, responseTopic2]);

          const str = payload.toString();
          let powerState = null;

          try {
            const parsed = JSON.parse(str);
            powerState = parsed?.POWER || parsed?.POWER1 || null;
          } catch {
            powerState = str === 'ON' || str === 'OFF' ? str : null;
          }

          return resolve({ success: true, message: 'Response received', payload: str });
        }
      };

      client.on('message', handleMessage);

      client.subscribe([responseTopic1, responseTopic2], (err) => {
        if (err) {
          client.removeListener('message', handleMessage);
          return reject({ success: false, message: 'Failed to subscribe to response topics' });
        }

        client.publish(inputTopic, message, {}, (err) => {
          if (err) {
            client.removeListener('message', handleMessage);
            client.unsubscribe([responseTopic1, responseTopic2]);
            return reject({ success: false, message: 'Failed to send command', error: err.message });
          }

          timeout = setTimeout(() => {
            client.removeListener('message', handleMessage);
            client.unsubscribe([responseTopic1, responseTopic2]);
            reject({ success: false, message: 'Device did not respond in time' });
          }, 5000);
        });
      });
    });
  } catch (err) {
    return { success: false, message: 'Error during command sending', error: err.message };
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////


async function setAutomationRule(accessToken, deviceId, onTime, offTime, timezone = 'Asia/Ulaanbaatar') {
  const { userId, isAdmin, error } = verifyToken(accessToken);
  if (error) return { success: false, message: error };

  if (!mongoose.Types.ObjectId.isValid(deviceId)) {
    return { success: false, message: 'Invalid deviceId format' };
  }

  try {
    const query = isAdmin
      ? { _id: deviceId }
      : {
          _id: deviceId,
          owner: {
            $elemMatch: {
              userId,
            },
          },
        };

    const device = await Device.findOne(query);
    if (!device) return { success: false, message: 'Device not found or access denied' };

    const rule = await Automation.create({
      deviceId,
      onTime,
      offTime,
      timezone,
    });

    return { success: true, message: 'Rule created', rule };
  } catch (err) {
    if (err.code === 11000) {
      return { success: false, message: 'Duplicate time rule' };
    }
    return { success: false, message: err.message };
  }
}

//////////////////////////////////////////////////////////////

async function updateAutomationRuleById(ruleId, updateData) {
  const { onTime, offTime, timezone } = updateData;
  try {
    const updated = await Automation.findByIdAndUpdate(ruleId, { onTime, offTime, timezone }, { new: true, runValidators: true });
    if (!updated) throw new Error('Rule not found');
    return { success: true, message: 'Rule updated', rule: updated };
  } catch (err) {
    if (err.code === 11000) throw new Error('Duplicate time rule');
    throw err;
  }
}

/////////////////////////////////////////////////////////////////

async function getAutomationRulesByDeviceId(deviceId) {
  const rules = await Automation.find({ deviceId });
  return { success: true, count: rules.length, rules };
}

///////////////////////////////////////////////////////////////////

async function deleteAutomationRuleById(ruleId) {
  const deleted = await Automation.findByIdAndDelete(ruleId);
  if (!deleted) return { success: false, message: 'Rule not found' };
  return { success: true, message: 'Rule deleted' };
}

////////////////////////////////////////////////////////

async function getPowerLogs(accessToken) {
  const { userId, isAdmin, error } = verifyToken(accessToken);
  if (error) return { success: false, message: error };

  let devices;

  if (isAdmin) {
    devices = await Device.find(); // Admin sees all devices
  } else {
    devices = await Device.find({ 'owner.userId': new mongoose.Types.ObjectId(userId) });
  }

  const clientIds = devices.map((d) => d.clientId);
  if (clientIds.length === 0) return { success: true, count: 0, logs: [] };

  const logs = await PowerLog.find({ clientId: { $in: clientIds } })
    .sort({ _id: -1 })
    .limit(100);

  return { success: true, count: logs.length, logs };
}

////////////////////////////////////////////////////

cron.schedule('* * * * *', async () => {
  try {
    const nowUtc = moment.utc();
    const automations = await Automation.find({ enabled: true });

    for (const rule of automations) {
      const now = nowUtc.clone().tz(rule.timezone || 'Asia/Ulaanbaatar');
      const time = now.format('HH:mm');

      if (time === rule.onTime || time === rule.offTime) {
        const device = await Device.findById(rule.deviceId);
        if (!device) continue;
        await sendCommand(device.clientId, device.entity ); 
        await logAutomationExecution({
          ruleId: rule._id,
          action,
        });
      }
    }
  } catch (err) {
    console.error('❌ Error running automation cron:', err.message);
  }
});

/////////////////////

module.exports = {
  subscribeToTopic,
  getLatestSensorData,
  sendCommand,
  setAutomationRule,
  updateAutomationRuleById,
  getAutomationRulesByDeviceId,
  deleteAutomationRuleById,
  getPowerLogs,
  getConnectedDevices,
};