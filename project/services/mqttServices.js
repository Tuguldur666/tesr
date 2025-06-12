const mqtt = require('mqtt');
const axios = require('axios');
const Device = require('../models/Device');
const SensorData = require('../models/data');
const Automation = require('../models/auto');
const cron = require('node-cron');
const moment = require('moment-timezone');



const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

const subscribedDevices = new Set();

function sendHttpEvent(endpoint, payload = { status: 'Connected' }) {
  axios.post(`http://192.168.1.168:3001/${endpoint}`, payload, {
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(() => {
    console.log(`➡️ Sent ${endpoint} to HTTP server`);
  }).catch((err) => {
    console.error(`❌ Failed to send ${endpoint}:`, err.message);
  });
}

client.on('connect', async () => {
  sendHttpEvent('connection');
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.topics?.sensor) {
      subscribeToTopic(device.topics.sensor);
    }
  });
});

client.on('reconnect', () => {
  sendHttpEvent('stat', { status: 'Reconnected' });
});

client.on('error', (err) => {
  sendHttpEvent('discooonection', { status: 'Error', message: err.message });
});

client.on('offline', () => {
  sendHttpEvent('discooonection', { status: 'Offline' });
});

client.on('message', async (topic, message) => {
  console.log('📩 MQTT message received:', topic, message.toString());

  try {
    const parsed = JSON.parse(message.toString());

    const match = topic.match(/^tele\/([^/]+)\/([^/]+)$/);
    if (!match) {
      console.log('⚠️ Topic did not match expected pattern:', topic);
      return;
    }

    const clientId = match[1];
    const {TempUnit, ...rest } = parsed;

    const [entity, sensorPayload] = Object.entries(rest).find(
      ([_, val]) => typeof val === 'object' && val !== null
    ) || [];

    if (!entity || !sensorPayload) {
      console.log(`⚠️ No valid sensor data found for client ${clientId}`);
      return;
    }

    const data = {
      ...sensorPayload
    };

    const sensorEntry = new SensorData({
      clientId,
      entity,
      data
    });

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
      console.error(`❌ Subscription failed for ${topic}:`, err.message);
    } else {
      subscribedDevices.add(topic);
      console.log(`📡 Subscribed to ${topic}`);
    }
  });
}

async function getLatestSensorData(clientId) {
  const latestData = await SensorData.findOne({ clientId }).sort({ timestamp: -1 });
  if (!latestData) {
    return { success: false, message: 'No sensor data available' };
  }
  return { success: true, data: latestData };
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
    console.error('⛔ Error running automation scheduler:', err.message);
  }
});

module.exports = {
  subscribeToTopic,
  getLatestSensorData,
  sendCommand,
  setAutomationRule,
};
