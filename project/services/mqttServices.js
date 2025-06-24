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
    return await DeviceStatusLog.findOneAndUpdate(
      { clientId },
      { power, status, message, date: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error(`❌ Failed to update status for ${clientId}:`, err.message);
  }
}

async function logPowerStatus({ clientId, entity, power }) {
  try {
    await new PowerLog({ clientId, entity, power }).save();
  } catch (err) {
    console.error(`❌ Failed to save power log for ${clientId}:`, err.message);
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
});

client.on('message', async (topic, message, packet) => {
  const msgStr = message.toString();
  const payload = JSON.parseSafe(msgStr);
  const stateMatch = topic.match(/^tele\/(.+?)\/STATE$/);
  const lwtMatch = topic.match(/^tele\/(.+?)\/LWT$/);
  const resultMatch = topic.match(/^stat\/(.+?)\/RESULT$/);
  const sensorMatch = topic.match(/^tele\/(.+?)\/SENSOR$/);

  let clientId = null;
  let type = null;

  // Extract clientId from topic
  if (stateMatch) clientId = stateMatch[1];
  else if (lwtMatch) clientId = lwtMatch[1];
  else if (resultMatch) clientId = resultMatch[1];
  else if (sensorMatch) clientId = sensorMatch[1];
  if (!clientId) return;

  // Try to determine type from clientId prefix
  if (clientId) {
    if (clientId.startsWith('VIOT_')) type = 'th';
    else if (clientId.startsWith('tasmota_')) type = 'bridge';
    else if (clientId.startsWith('sonoff_')) type = 'sonoff';
  }

  // Fallback to username if still not determined
  if (!type) {
    const username = packet?.username || null;
    console.log("Username from packet:", username);

    if (username && username.includes('_')) {
      const parts = username.split('_');
      console.log("Username split parts:", parts);

      // Usually, type is the second part, like "th" or "bridge"
      type = parts[1]?.toLowerCase() || null;
      console.log("Extracted type from username:", type);
    } else {
      console.log("Username does not contain underscore or is null");
    }
  }

  try {
    if (!connectedClients.has(clientId)) {
      connectedClients.set(clientId, { type: type || null, entities: new Set() });
    } else {
      const existing = connectedClients.get(clientId);
      if (!existing.type && type) existing.type = type;
    }

    const deviceInfo = connectedClients.get(clientId);

    if (lwtMatch) {
      const status = msgStr.toLowerCase() === 'online' ? 'connected' : 'disconnected';
      await logDeviceStatus(clientId, 'unknown', status, `LWT: ${msgStr}`);
      if (status !== 'connected') connectedClients.delete(clientId);
    }

    if (sensorMatch) {
      console.log(`Received SENSOR for clientId=${clientId}:`, payload);
      for (const [entity, data] of Object.entries(payload)) {
        if (entity !== 'Time' && typeof data === 'object') {
          deviceInfo.entities.add(entity);
          console.log(`Added entity ${entity} for clientId ${clientId}`);
          await new SensorData({ clientId, entity, data, timestamp: new Date() }).save();
        }
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
    entity: [...info.entities][0] || null,
  }));
  return { success: true, count: result.length, devices: result };
}

JSON.parseSafe = function (str) {
  try { return JSON.parse(str); } catch { return {}; }
};

////////////////////////////////////////////////////////////////////////////////
async function getLatestSensorData(clientId, entity) {
  try {
    const sensor = await SensorData.findOne({ clientId, entity }).sort({ timestamp: -1 });
    const status = await DeviceStatusLog.findOne({ clientId, entity }).sort({ date: -1 });
    if (!sensor && !status) return { success: false, message: 'No data available' };
    return { success: true, data: { sensor, status } };
  } catch (err) {
    return { success: false, message: 'Error retrieving data' };
  }
}

async function sendCommand(clientId, entity) {
  try {
    const device = await Device.findOne({ clientId, entity });
    if (!device) {
      return { success: false, message: 'No device available' };
    }

    const inputTopic = `cmnd/${clientId}/POWER`;
    const message = 'TOGGLE';
    const responseTopic = `stat/${clientId}/RESULT`;

    return await new Promise((resolve, reject) => {
      let timeout;

      const handleMessage = (topic, payload) => {
        if (topic === responseTopic) {
          clearTimeout(timeout);
          client.removeListener('message', handleMessage);
          client.unsubscribe(responseTopic, () => { });
          try {
            const data = JSON.parse(payload.toString());
            resolve({ success: true, message: 'Response received', data });
          } catch (err) {
            resolve({ success: true, message: 'Response received', raw: payload.toString() });
          }
        }
      };

      client.on('message', handleMessage);

      client.subscribe(responseTopic, (err) => {
        if (err) {
          client.removeListener('message', handleMessage);
          return reject({ success: false, message: 'Failed to subscribe to response topic' });
        }

        client.publish(inputTopic, message, {}, (err) => {
          if (err) {
            client.removeListener('message', handleMessage);
            client.unsubscribe(responseTopic, () => { });
            return reject({ success: false, message: 'Failed to send command', error: err.message });
          }

          timeout = setTimeout(() => {
            client.removeListener('message', handleMessage);
            client.unsubscribe(responseTopic, () => { });
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
    if (!device) {
      return { success: false, message: 'Device not found or access denied' };
    }

    const rule = await Automation.create({
      clientId,
      entity,
      topic: `cmnd/${clientId}/POWER`,
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
  const logs = await PowerLog.find({ clientId: { $in: clientIds } }).sort({ _id: -1 });
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
      await logAutomationExecution({ clientId: rule.clientId, ruleId: rule._id, topic: rule.topic, action: 'ON' });
    } else if (time === rule.offTime) {
      await sendCommand(rule.clientId, rule.entity);
      await logAutomationExecution({ clientId: rule.clientId, ruleId: rule._id, topic: rule.topic, action: 'OFF' });
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
