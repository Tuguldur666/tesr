const mqtt = require('mqtt');
const axios = require('axios');
const Device = require('../models/Device');
const SensorData = require('../models/data');
const Automation = require('../models/auto');
const DeviceStatusLog = require('../models/status');
const PowerLog = require('../models/powerlog');
const AutomationLog = require('../models/autolog');
const cron = require('node-cron');
const moment = require('moment-timezone');
const { verifyToken } = require('../utils/token');

const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

const subscribedDevices = new Set();
const connectedClients = new Map();
const powerDebounce = new Map();
const pendingPowerUpdates = new Map();

let powerLogCallCount = 0; // <-- Counter added

async function ensureIndexes() {
  try {
    await PowerLog.collection.createIndex({ clientId: 1, power: 1, timestamp: -1 });
    console.log('PowerLog indexes ensured');
  } catch (err) {
    console.error('Error ensuring indexes:', err);
  }
}

ensureIndexes();

function sendHttpEvent(endpoint, payload = { status: 'Connected' }) {
  axios.post(`http://192.168.1.168:3001/${endpoint}`, payload, {
    headers: { 'Content-Type': 'application/json' },
  }).then(() => {
    console.log(`➡️ Sent ${endpoint} to HTTP server`);
  }).catch((err) => {
    console.error(`❌ Failed to send ${endpoint}:`, err.message);
  });
}

async function logDeviceStatus(clientId, power, status, message = '') {
  try {
    return await DeviceStatusLog.updateOne(
      { clientId },
      { $set: { power, status, message, date: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`❌ Failed to update status for ${clientId}:`, err.message);
  }
}


const recentPowerLogs = new Map(); 

async function logPowerStatus({ clientId, power }) {
  powerLogCallCount++;
  console.log(`logPowerStatus called ${powerLogCallCount} times for ${clientId} with power=${power}`);

  if (!['ON', 'OFF'].includes(power)) return;

  const now = Date.now();
  const key = clientId;
  const last = recentPowerLogs.get(key);

  if (last && last.power === power && now - last.ts < 1000) {
    console.log(`🛑 Skipping duplicate (debounced) power log for ${clientId}, power=${power}`);
    return;
  }

  try {
    await PowerLog.create({ clientId, power, timestamp: new Date() });
    recentPowerLogs.set(key, { power, ts: now });
    console.log(`✅ PowerLog saved: ${clientId}, ${power}`);
  } catch (err) {
    console.error(`Power log error for ${clientId}:`, err);
  }
}


async function logAutomationExecution({ ruleId, action }) {
  try {
    await new AutomationLog({ ruleId, action }).save();
  } catch (err) {
    console.error(`❌ Failed to log automation execution:`, err.message);
  }
}

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

client.on('connect', () => {
  sendHttpEvent('connection');
  console.log('MQTT connected');

  client.subscribe('tele/+/STATE');
  client.subscribe('tele/+/LWT');
  client.subscribe('tele/+/SENSOR');
  client.subscribe('stat/+/RESULT');
  client.subscribe('stat/+/POWER');
});

client.on('message', async (topic, message, packet) => {
  const msgStr = message.toString();
  let payload;
  try { payload = JSON.parse(msgStr); } catch { payload = {}; }

  const stateMatch = topic.match(/^tele\/(.+?)\/STATE$/);
  const lwtMatch = topic.match(/^tele\/(.+?)\/LWT$/);
  const resultMatch = topic.match(/^stat\/(.+?)\/RESULT$/);
  const powerMatch = topic.match(/^stat\/(.+?)\/POWER$/);
  const sensorMatch = topic.match(/^tele\/(.+?)\/SENSOR$/);

  let clientId = stateMatch?.[1] || lwtMatch?.[1] || resultMatch?.[1] || powerMatch?.[1] || sensorMatch?.[1];
  if (!clientId) return;

  let type = null;
  if (clientId.startsWith('VIOT_')) type = 'th';
  else if (clientId.startsWith('tasmota_')) type = 'bridge';
  else if (clientId.startsWith('sonoff_')) type = 'sonoff';
  else if (packet?.username?.includes('_')) {
    const parts = packet.username.split('_');
    type = parts[1]?.toLowerCase();
  }

  try {
    if (!connectedClients.has(clientId)) {
      connectedClients.set(clientId, { type: type || null, entities: new Set() });
    } else if (!connectedClients.get(clientId).type && type) {
      connectedClients.get(clientId).type = type;
    }

    const deviceInfo = connectedClients.get(clientId);

    if (lwtMatch) {
      const status = msgStr.toLowerCase() === 'online' ? 'connected' : 'disconnected';
      await logDeviceStatus(clientId, 'unknown', status, `LWT: ${msgStr}`);
      if (status !== 'connected') connectedClients.delete(clientId);
    }

    if (sensorMatch) {
      for (const [entity, data] of Object.entries(payload)) {
        if (entity !== 'Time' && typeof data === 'object') {
          deviceInfo.entities.add(entity);
          await new SensorData({ clientId, entity, data, timestamp: new Date() }).save();
        }
      }
    }

    if (powerMatch) {
      const powerState = msgStr === 'ON' ? 'ON' : msgStr === 'OFF' ? 'OFF' : null;
      if (powerState && !pendingPowerUpdates.has(clientId)) {
        pendingPowerUpdates.set(clientId, true);
        try {
          await logPowerStatus({ clientId, power: powerState });
          await logDeviceStatus(clientId, powerState, 'connected');
        } finally {
          setTimeout(() => pendingPowerUpdates.delete(clientId), 100);
        }
      }
    } else if (resultMatch || stateMatch) {
      const powerState = payload?.POWER || payload?.POWER1 || null;
      if (powerState === 'ON' || powerState === 'OFF') {
        await logDeviceStatus(clientId, powerState, 'connected');
      }
    }
  } catch (err) {
    console.error('❗ MQTT handler error:', err.message);
  }
});

async function getConnectedDevices() {
  const result = Array.from(connectedClients.entries()).map(([clientId, info]) => ({
    clientId,
    type: info.type || null,
    entities: Array.from(info.entities || [])
  }));
  return { success: true, count: result.length, devices: result };
}

// Other exported functions unchanged

async function getLatestSensorData(clientId, entity) {
  try {
    const sensor = await SensorData.findOne({ clientId, entity }).sort({ _id: -1 });
    const status = await DeviceStatusLog.findOne({ clientId, entity }).sort({ _id: -1 });
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
          client.unsubscribe(responseTopic1);
          client.unsubscribe(responseTopic2);

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

async function setAutomationRule(accessToken, clientId, entity, onTime, offTime, timezone = 'Asia/Ulaanbaatar') {
  const { userId, error } = verifyToken(accessToken);
  if (error) return { success: false, message: error };

  try {
    const device = await Device.findOne({ clientId, entity, owner: userId });
    if (!device) return { success: false, message: 'Device not found or access denied' };

    const rule = await Automation.create({
      clientId,
      entity,
      topic: `cmnd/${clientId}/POWER`,
      onTime,
      offTime,
      timezone,
      owner: userId
    });

    return { success: true, message: 'Rule created', rule };
  } catch (err) {
    if (err.code === 11000) return { success: false, message: 'Duplicate time rule' };
    return { success: false, message: err.message };
  }
}

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

async function getAutomationRulesByClientId(clientId, entity) {
  const rules = await Automation.find({ clientId, entity });
  return { success: true, count: rules.length, rules };
}

async function deleteAutomationRuleById(ruleId) {
  const deleted = await Automation.findByIdAndDelete(ruleId);
  if (!deleted) return { success: false, message: 'Rule not found' };
  return { success: true, message: 'Rule deleted' };
}

async function getPowerLogs(accessToken) {
  const { userId, error } = verifyToken(accessToken);
  if (error) return { success: false, message: error };
  const devices = await Device.find({ owner: userId });
  const clientIds = devices.map((d) => d.clientId);
  if (clientIds.length === 0) return { success: true, count: 0, logs: [] };
  const logs = await PowerLog.find({ clientId: { $in: clientIds } }).sort({ _id: -1 }).limit(100);
  return { success: true, count: logs.length, logs };
}

cron.schedule('* * * * *', async () => {
  const nowUtc = moment.utc();
  const automations = await Automation.find({});
  for (const rule of automations) {
    const now = nowUtc.clone().tz(rule.timezone);
    const time = now.format('HH:mm');
    if (time === rule.onTime) {
      await sendCommand(rule.clientId, rule.entity);
      await logAutomationExecution({ ruleId: rule._id, action: 'ON' });
    } else if (time === rule.offTime) {
      await sendCommand(rule.clientId, rule.entity);
      await logAutomationExecution({ ruleId: rule._id, action: 'OFF' });
    }
  }
});

module.exports = {
  subscribeToTopic,
  getLatestSensorData,
  sendCommand,
  setAutomationRule,
  updateAutomationRuleById,
  getAutomationRulesByClientId,
  deleteAutomationRuleById,
  getPowerLogs,
  getConnectedDevices,
};