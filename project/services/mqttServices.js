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

const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

const subscribedDevices = new Set();

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
      { power, status, message, timestamp: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error(`❌ Failed to update status for ${clientId}:`, err.message);
  }
}

async function logPowerStatus({ clientId, power, source, topic }) {
  try {
    const now = new Date();
    const roundedTime = new Date(Math.floor(now.getTime() / 1000) * 1000);

    const alreadyExists = await PowerLog.exists({
      clientId,
      power,
      source,
      topic,
      timestamp: {
        $gte: new Date(roundedTime.getTime() - 2000),
        $lt: new Date(roundedTime.getTime() + 2000),
      },
    });

    if (alreadyExists) return;

    const log = new PowerLog({ clientId, power, source, topic, timestamp: now });
    await log.save();
  } catch (err) {
    console.error(`❌ Failed to save power log for ${clientId}:`, err.message);
  }
}

async function logAutomationExecution({ clientId, ruleId, topic, action }) {
  if (!['ON', 'OFF'].includes(action)) {
    throw new Error('Invalid action');
  }
  await AutomationLog.create({ clientId, ruleId, topic, action });
}

function subscribeToTopic(topic) {
  if (subscribedDevices.has(topic)) return;
  client.subscribe(topic, (err) => {
    if (!err) subscribedDevices.add(topic);
  });
}

function subscribeDeviceTopics(device) {
  if (device.topics) {
    Object.values(device.topics).forEach(topic => {
      if (typeof topic === 'string' && topic.trim()) subscribeToTopic(topic);
    });
  }
  if (device.clientId) {
    ['POWER', 'RESULT', 'SENSOR'].forEach(type => subscribeToTopic(`stat/${device.clientId}/${type}`));
    subscribeToTopic(`tele/${device.clientId}/LWT`);
  }
}

client.on('connect', async () => {
  sendHttpEvent('connection');
  const devices = await Device.find({});
  devices.forEach(device => {
    subscribeDeviceTopics(device);
    if (device.clientId) logDeviceStatus(device.clientId, 'on', 'connected', 'MQTT connected');
  });
});

client.on('reconnect', async () => {
  sendHttpEvent('stat', { status: 'Reconnected' });
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) logDeviceStatus(device.clientId, 'on', 'connected', 'MQTT reconnected');
  });
});

client.on('error', async (err) => {
  sendHttpEvent('disconnection', { status: 'Error', message: err.message });
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) logDeviceStatus(device.clientId, 'off', 'error', `MQTT error: ${err.message}`);
  });
});

client.on('offline', async () => {
  sendHttpEvent('disconnection', { status: 'Offline' });
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) logDeviceStatus(device.clientId, 'off', 'offline', 'MQTT offline');
  });
});

client.on('message', async (topic, message) => {
  try {
    const trimmedTopic = topic.trim();
    const msgStr = message.toString();

    const statMatch = trimmedTopic.match(/^stat\/(.+?)\/(POWER|SENSOR)$/);
    const lwtMatch = trimmedTopic.match(/^tele\/(.+?)\/LWT$/);

    if (statMatch) {
      const [_, clientId, subTopic] = statMatch;
      if (subTopic === 'POWER') {
        const powerStatus = msgStr.toLowerCase();
        if (['on', 'off'].includes(powerStatus)) {
          await logDeviceStatus(clientId, powerStatus, 'connected', `POWER: ${powerStatus}`);
          await logPowerStatus({ clientId, power: powerStatus, source: 'stat', topic: trimmedTopic });
        }
      } else if (subTopic === 'SENSOR') {
        try {
          const sensorData = JSON.parse(msgStr);
          for (const [entity, data] of Object.entries(sensorData)) {
            if (entity === 'Time') continue;
            if (typeof data === 'object' && data !== null) {
              if (clientId === 'VIOT_E99614' && data.Id) delete data.Id;
              const sensorEntry = new SensorData({ clientId, entity, data, timestamp: new Date() });
              await sensorEntry.save();
            }
          }
        } catch (err) {
          console.error('❌ SENSOR parse error:', err.message);
        }
      }
    } else if (lwtMatch) {
      const clientId = lwtMatch[1];
      const statusPayload = msgStr.toLowerCase();
      const power = statusPayload === 'online' ? 'on' : (statusPayload === 'offline' ? 'off' : 'unknown');
      await logDeviceStatus(clientId, power, 'connected', `LWT: ${msgStr}`);
    }
  } catch (err) {
    console.error('❗ Message handler error:', err.message);
  }
});

async function getLatestSensorData(clientId) {
  try {
    const sensor = await SensorData.findOne({ clientId }).sort({ timestamp: -1 });
    const status = await DeviceStatusLog.findOne({ clientId }).sort({ timestamp: -1 });
    if (!sensor && !status) return { success: false, message: 'No data available' };
    return { success: true, data: { sensor, status } };
  } catch (err) {
    return { success: false, message: 'Error retrieving data' };
  }
}

async function sendCommand(inputTopic, message) {
  return new Promise((resolve, reject) => {
    if (!client.connected) return reject(new Error('MQTT not connected'));
    const match = inputTopic.match(/^[^/]+\/([^/]+)\/[^/]+$/);
    if (!match) return reject(new Error('Invalid topic format'));
    const clientId = match[1];
    const commandTopic = `cmnd/${clientId}/POWER`;
    if (message.toUpperCase() !== 'TOGGLE' && message.toUpperCase() !== 'ON' && message.toUpperCase() !== 'OFF') {
      return reject(new Error('Only TOGGLE, ON, OFF commands are allowed'));
    }
    client.publish(commandTopic, message.toUpperCase(), {}, (err) => {
      if (err) return reject(err);
      resolve({ success: true, message: `Sent ${message} to ${commandTopic}` });
    });
  });
}

async function setAutomationRule(clientId, topic, onTime, offTime, timezone = 'Asia/Ulaanbaatar') {
  if (!clientId || !topic || !onTime || !offTime) throw new Error('Missing required fields');
  try {
    const rule = await Automation.create({ clientId, topic, onTime, offTime, timezone });
    return { success: true, message: 'Rule created', rule };
  } catch (err) {
    if (err.code === 11000) throw new Error('Duplicate time rule');
    throw err;
  }
}

async function updateAutomationRuleById(ruleId, updateData) {
  const { topic, onTime, offTime, timezone } = updateData;
  if (!topic || !onTime || !offTime) throw new Error('Missing fields');
  try {
    const updated = await Automation.findByIdAndUpdate(
      ruleId,
      { topic, onTime, offTime, timezone },
      { new: true, runValidators: true }
    );
    if (!updated) throw new Error('Rule not found');
    return { success: true, message: 'Rule updated', rule: updated };
  } catch (err) {
    if (err.code === 11000) throw new Error('Duplicate time rule');
    throw err;
  }
}

async function getAutomationRulesByClientId(clientId) {
  if (!clientId) throw new Error('Missing clientId');
  const rules = await Automation.find({ clientId });
  return { success: true, count: rules.length, rules };
}

async function deleteAutomationRuleById(ruleId) {
  const deleted = await Automation.findByIdAndDelete(ruleId);
  if (!deleted) return { success: false, message: 'Rule not found' };
  return { success: true, message: 'Rule deleted' };
}

cron.schedule('* * * * *', async () => {
  const nowUtc = moment.utc();
  const automations = await Automation.find({});
  for (const rule of automations) {
    const now = nowUtc.clone().tz(rule.timezone);
    const time = now.format('HH:mm');
    if (time === rule.onTime) {
      await sendCommand(rule.topic, 'ON');
      await logAutomationExecution({ clientId: rule.clientId, ruleId: rule._id, topic: rule.topic, action: 'ON' });
    } else if (time === rule.offTime) {
      await sendCommand(rule.topic, 'OFF');
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
};