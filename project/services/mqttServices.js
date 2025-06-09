const mqtt = require('mqtt');
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

client.on('connect', async () => {
  console.log('✅ Connected to EMQX Broker');
  const devices = await Device.find({});
  devices.forEach(device => {
    subscribeToDevice(device.deviceId);
  });
});

client.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT broker...');
});

client.on('error', (err) => {
  console.error('❌ MQTT connection error:', err);
});

client.on('offline', () => {
  console.warn('⚠️ MQTT client is offline');
});

client.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const match = topic.match(/^tele\/([^/]+)\/SENSOR$/);
    if (!match) return;
    const deviceId = match[1];

    const sensorData = new SensorData({
      deviceId,
      data,
    });

    await sensorData.save();
    console.log(`📥 Saved sensor data for device ${deviceId}`, data);

  } catch (e) {
    console.error('❗ JSON parse error or DB error:', e.message);
  }
});


function subscribeToDevice(deviceId) {
  if (subscribedDevices.has(deviceId)) return;

  const sensorTopic = `tele/${deviceId}/SENSOR`;
  client.subscribe(sensorTopic, (err) => {
    if (err) {
      console.error(`❌ Subscription failed for ${sensorTopic}:`, err);
    } else {
      subscribedDevices.add(deviceId);
      console.log(`📡 Subscribed to ${sensorTopic}`);
    }
  });
}


async function getLatestSensorData(deviceId) {
  const latestData = await SensorData.findOne({ deviceId }).sort({ timestamp: -1 });
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
      if (err) {
        return reject(err);
      }
      resolve({ success: true, message: `Command sent to "${topic}": ${message}` });
    });
  });
}


async function setAutomationRule(deviceId, topic, onTime, offTime, timezone = 'Asia/Ulaanbaatar') {
  if (!topic) throw new Error('topic is not defined');

  const existing = await Automation.findOne({ deviceId });

  if (existing) {
    existing.topic = topic;
    existing.onTime = onTime;
    existing.offTime = offTime;
    existing.timezone = timezone;
    await existing.save();
    return { success: true, message: 'Automation rule updated' };
  }

  const newRule = new Automation({ deviceId, topic, onTime, offTime, timezone });
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
        console.log(`Automation ON sent to ${rule.deviceId} at ${currentTimeStr}`);
      } else if (currentTimeStr === rule.offTime) {
        await sendCommand(rule.topic, 'OFF');
        console.log(`Automation OFF sent to ${rule.deviceId} at ${currentTimeStr}`);
      }
    }
  } catch (err) {
    console.error('Error running automation scheduler:', err.message);
  }
});

module.exports = {
  subscribeToDevice,
  getLatestSensorData,
  sendCommand,
  setAutomationRule,
};
