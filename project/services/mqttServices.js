const mqtt = require('mqtt');
const axios = require('axios');
const Device = require('../models/Device');
const SensorData = require('../models/data');
const Automation = require('../models/auto');
const DeviceStatusLog = require('../models/status');
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

async function logDeviceStatus(clientId, status, message = '') {
  try {
    const updatedLog = await DeviceStatusLog.findOneAndUpdate(
      { clientId },
      { status, message, timestamp: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`📝 Logged status for device ${clientId}: ${status} (${message})`);
    return updatedLog;
  } catch (err) {
    console.error(`❌ Failed to log device status for ${clientId}:`, err.message);
  }
}

function subscribeDeviceTopics(device) {
  if (device.topics) {
    Object.values(device.topics).forEach(topic => {
      if (typeof topic === 'string' && topic.trim()) {
        subscribeToTopic(topic);
      }
    });
  }
}

client.on('connect', async () => {
  sendHttpEvent('connection');

  const devices = await Device.find({});
  devices.forEach(device => {
    subscribeDeviceTopics(device);

    if (device.clientId) {
      logDeviceStatus(device.clientId, 'connected', 'MQTT client connected');
    }
  });
});

client.on('reconnect', async () => {
  sendHttpEvent('stat', { status: 'Reconnected' });

  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) {
      logDeviceStatus(device.clientId, 'connected', 'MQTT client reconnected');
    }
  });
});

client.on('error', async (err) => {
  sendHttpEvent('disconnection', { status: 'Error', message: err.message });

  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) {
      logDeviceStatus(device.clientId, 'disconnected', `MQTT error: ${err.message}`);
    }
  });
});

client.on('offline', async () => {
  sendHttpEvent('disconnection', { status: 'Offline' });

  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) {
      logDeviceStatus(device.clientId, 'disconnected', 'MQTT client went offline');
    }
  });
});

client.on('message', async (topic, message) => {
  const msgStr = message.toString();
  console.log('📩 MQTT message received:', topic, msgStr);

  if (topic.startsWith('stat/')) {
    const statMatch = topic.match(/^stat\/([^/]+)\/(RESULT|POWER)$/);
    if (statMatch) {
      const clientId = statMatch[1];
      const subTopic = statMatch[2];

      let powerStatus;

      if (subTopic === 'RESULT') {
        try {
          const jsonPayload = JSON.parse(msgStr);
          powerStatus = jsonPayload.POWER?.toLowerCase();
        } catch {
          console.warn('⚠️ Failed to parse RESULT payload JSON:', msgStr);
        }
      } else if (subTopic === 'POWER') {
        powerStatus = msgStr.toLowerCase();
      }

      if (powerStatus === 'on' || powerStatus === 'off') {
        await logDeviceStatus(clientId, powerStatus, `Power status from stat/${subTopic}: ${powerStatus.toUpperCase()}`);
      } else {
        console.warn(`⚠️ Unrecognized power status '${powerStatus}' for device ${clientId}`);
      }
      return;
    }
  }

  if (topic.endsWith('/STATUS')) {
    const clientId = topic.split('/')[1];
    const status = msgStr.toLowerCase();

    if (status === 'on' || status === 'off') {
      await logDeviceStatus(clientId, status, 'Status update from tele STATUS');
      return;
    }
  }

  try {
    const parsed = JSON.parse(msgStr);

    const match = topic.match(/^tele\/([^/]+)\/([^/]+)$/);
    if (!match) {
      console.log('⚠️ Topic did not match expected pattern:', topic);
      return;
    }

    const clientId = match[1];
    const { TempUnit, ...rest } = parsed;

    const [entity, sensorPayload] = Object.entries(rest).find(
      ([_, val]) => typeof val === 'object' && val !== null
    ) || [];

    if (!entity || !sensorPayload) {
      console.log(`⚠️ No valid sensor data found for client ${clientId}`);
      return;
    }

    const data = { ...sensorPayload };

    const sensorEntry = new SensorData({ clientId, entity, data });

    try {
      const savedEntry = await sensorEntry.save();
      console.log('✅ Sensor entry saved to DB:', savedEntry);

      const confirmEntry = await SensorData.findById(savedEntry._id).lean();
      if (confirmEntry) {
        console.log('🔄 Confirmed saved in DB:', confirmEntry);
      } else {
        console.warn('❓ Entry not found in DB after save!');
      }
    } catch (saveErr) {
      console.error('❗ Mongoose save error:', saveErr);
    }
  } catch (e) {
    console.error('❗ Failed to handle MQTT message:', e.message);
  }
});

function subscribeToTopic(topic) {
  if (subscribedDevices.has(topic)) return;
  client.subscribe(topic, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
    } else {
      subscribedDevices.add(topic);
      console.log(`📡 Subscribed to ${topic}`);
    }
  });
}

async function getLatestSensorData(clientId) {
  const latest = await SensorData.findOne({ clientId }).sort({ timestamp: -1 });
  if (!latest) {
    return { success: false, message: 'No sensor data available' };
  }
  return { success: true, data: latest };
}

async function sendCommand(topic, message) {
  return new Promise((resolve, reject) => {
    if (!client.connected) {
      return reject(new Error('MQTT client not connected'));
    }
    client.publish(topic, message, {}, (err) => {
      if (err) return reject(err);
      resolve({ success: true, message: `Command sent to "${topic}": ${message}` });
    });
  });
}

async function setAutomationRule(clientId, topic, onTime, offTime, timezone = 'Asia/Ulaanbaatar') {
  if (!topic) throw new Error('topic is not defined');

  const existing = await Automation.findOne({ clientId });

  if (existing) {
    existing.topic = topic;
    existing.onTime = onTime;
    existing.offTime = offTime;
    existing.timezone = timezone;
    await existing.save();
    return { success: true, message: 'Automation rule updated' };
  }

  const newRule = new Automation({ clientId, topic, onTime, offTime, timezone });
  await newRule.save();
  return { success: true, message: 'Automation rule created' };
}

cron.schedule('* * * * *', async () => {
  const nowUtc = moment.utc();

  try {
    const automations = await Automation.find({});
    for (const rule of automations) {
      const now = nowUtc.clone().tz(rule.timezone);
      const currentTimeStr = now.format('HH:mm');

      if (currentTimeStr === rule.onTime) {
        await sendCommand(rule.topic, 'ON');
        console.log(`⚙️ Automation ON sent to ${rule.clientId} at ${currentTimeStr}`);
      } else if (currentTimeStr === rule.offTime) {
        await sendCommand(rule.topic, 'OFF');
        console.log(`⚙️ Automation OFF sent to ${rule.clientId} at ${currentTimeStr}`);
      }
    }
  } catch (err) {
    console.error('⛔ Automation error:', err.message);
  }
});

module.exports = {
  subscribeToTopic,
  getLatestSensorData,
  sendCommand,
  setAutomationRule,
};
