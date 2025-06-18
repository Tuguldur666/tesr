const mqtt = require('mqtt');
const axios = require('axios');
const Device = require('../models/Device');
const SensorData = require('../models/data');
const Automation = require('../models/auto');
const DeviceStatusLog = require('../models/status');
const PowerLog = require('../models/powerlog');
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
    const updatedLog = await DeviceStatusLog.findOneAndUpdate(
      { clientId },
      { power, status, message, timestamp: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`📝 Status updated for ${clientId}: power=${power}, status=${status}, message=${message}`);
    return updatedLog;
  } catch (err) {
    console.error(`❌ Failed to update status for ${clientId}:`, err.message);
  }
}

async function logPowerStatus({ clientId, power, source, topic }) {
  try {
    const log = new PowerLog({
      clientId,
      power,
      source,
      topic,
      timestamp: new Date(),
    });
    await log.save();
    console.log(`⚡ Power log saved: ${clientId}, power=${power}, topic=${topic}`);
  } catch (err) {
    console.error(`❌ Failed to save power log for ${clientId}:`, err.message);
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

  if (device.clientId) {
    subscribeToTopic(`stat/${device.clientId}/POWER`);
    subscribeToTopic(`stat/${device.clientId}/RESULT`);
    subscribeToTopic(`stat/${device.clientId}/SENSOR`);
    subscribeToTopic(`tele/${device.clientId}/LWT`);
  }
}

client.on('connect', async () => {
  sendHttpEvent('connection');
  const devices = await Device.find({});
  devices.forEach(device => {
    subscribeDeviceTopics(device);
    if (device.clientId) {
      logDeviceStatus(device.clientId, 'on', 'connected', 'MQTT client connected');
    }
  });
});

client.on('reconnect', async () => {
  sendHttpEvent('stat', { status: 'Reconnected' });
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) {
      logDeviceStatus(device.clientId, 'on', 'connected', 'MQTT client reconnected');
    }
  });
});

client.on('error', async (err) => {
  sendHttpEvent('disconnection', { status: 'Error', message: err.message });
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) {
      logDeviceStatus(device.clientId, 'off', 'error', `MQTT error: ${err.message}`);
    }
  });
});

client.on('offline', async () => {
  sendHttpEvent('disconnection', { status: 'Offline' });
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) {
      logDeviceStatus(device.clientId, 'off', 'offline', 'MQTT client went offline');
    }
  });
});

client.on('message', async (topic, message) => {
  try {
    const trimmedTopic = topic.trim();
    const msgStr = message.toString();
    console.log(`[DEBUG] Incoming message: topic='${trimmedTopic}', message='${msgStr}'`);

    const statMatch = trimmedTopic.match(/^stat\/([^/]+)\/(RESULT|POWER|SENSOR)$/);
    if (statMatch) {
      const clientId = statMatch[1];
      const subTopic = statMatch[2];

      if (subTopic === 'RESULT') {
        // ❌ Skip logging to prevent duplication
        return;
      } else if (subTopic === 'POWER') {
        const powerStatus = msgStr.toLowerCase();
        if (powerStatus === 'on' || powerStatus === 'off') {
          await logDeviceStatus(clientId, powerStatus, 'connected', `Power status from stat/POWER: ${powerStatus.toUpperCase()}`);
          await logPowerStatus({
            clientId,
            power: powerStatus,
            source: 'stat',
            topic: trimmedTopic,
          });
        } else {
          console.warn(`⚠️ Unrecognized power status '${powerStatus}' for device ${clientId}`);
        }
      } else if (subTopic === 'SENSOR') {
        try {
          const sensorData = JSON.parse(msgStr);
          for (const [entity, data] of Object.entries(sensorData)) {
            if (entity === 'Time') continue;
            if (typeof data === 'object' && data !== null) {
              if (clientId === 'VIOT_E99614' && data.Id) {
                delete data.Id;
              }
              const sensorEntry = new SensorData({
                clientId,
                entity,
                data,
                timestamp: new Date(),
              });
              await sensorEntry.save();
              console.log(`✅ Saved sensor data for ${clientId} entity ${entity}`);
            }
          }
        } catch (err) {
          console.error('❌ Failed to parse SENSOR JSON:', err.message);
        }
      }
      return;
    }

    const lwtMatch = trimmedTopic.match(/^tele\/([^/]+)\/LWT$/);
    if (lwtMatch) {
      const clientId = lwtMatch[1];
      const statusPayload = msgStr.toLowerCase();
      const power = statusPayload === 'online' ? 'on' : (statusPayload === 'offline' ? 'off' : 'unknown');
      await logDeviceStatus(clientId, power, 'connected', `LWT status: ${msgStr}`);
      return;
    }

    if (trimmedTopic.endsWith('/STATUS')) {
      const clientId = trimmedTopic.split('/')[1];
      const status = msgStr.toLowerCase();
      if (status === 'on' || status === 'off') {
        await logDeviceStatus(clientId, status, 'connected', 'Status update from tele STATUS');
        return;
      }
    }

    try {
      const parsed = JSON.parse(msgStr);
      const match = trimmedTopic.match(/^tele\/([^/]+)\/([^/]+)$/);
      if (!match) return;

      const clientId = match[1];
      const { TempUnit, ...rest } = parsed;

      const [entity, sensorPayload] = Object.entries(rest).find(
        ([_, val]) => typeof val === 'object' && val !== null
      ) || [];

      if (!entity || !sensorPayload) return;

      if (clientId === 'VIOT_E99614' && sensorPayload.Id) {
        delete sensorPayload.Id;
      }

      const sensorEntry = new SensorData({
        clientId,
        entity,
        data: sensorPayload,
        timestamp: new Date(),
      });

      const savedEntry = await sensorEntry.save();
      console.log('✅ Sensor entry saved:', savedEntry);
    } catch (e) {
      console.error('❗ Failed to parse telemetry JSON:', e.message);
    }
  } catch (err) {
    console.error('❗ Top-level message error:', err.message);
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
  if (!latest) return { success: false, message: 'No sensor data available' };
  return { success: true, data: latest };
}

async function sendCommand(topic, message) {
  return new Promise((resolve, reject) => {
    if (!client.connected) return reject(new Error('MQTT client not connected'));
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
