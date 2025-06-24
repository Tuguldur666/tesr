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
    const result = await DeviceStatusLog.findOneAndUpdate(
      { clientId },
      { power, status, message, date: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return result;
  } catch (err) {
    console.error(`❌ Failed to update status for ${clientId}:`, err.message);
  }
}

async function logPowerStatus({ clientId, entity, power }) {
  try {
    const log = new PowerLog({ clientId, entity, power });
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
    if (!err) {
      subscribedDevices.add(topic);
      console.log(`Subscribed to topic: ${topic}`);
    } else {
      console.error(`Failed to subscribe topic ${topic}:`, err.message);
    }
  });
}

function subscribeDeviceTopics(device) {
  if (device.clientId) {
    subscribeToTopic(`tele/${device.clientId}/POWER`);
    subscribeToTopic(`tele/${device.clientId}/RESULT`);
    subscribeToTopic(`tele/${device.clientId}/LWT`);
    subscribeToTopic(`tele/${device.clientId}/SENSOR`);
    subscribeToTopic(`stat/${device.clientId}/POWER`);
    subscribeToTopic(`stat/${device.clientId}/RESULT`);
  }
}

client.on('connect', async () => {
  sendHttpEvent('connection');
  console.log('MQTT connected');
  const devices = await Device.find({});
  devices.forEach(device => {
    subscribeDeviceTopics(device);
    if (device.clientId) logDeviceStatus(device.clientId, 'unknown', 'connected', 'MQTT connected');
  });
});

client.on('reconnect', async () => {
  sendHttpEvent('stat', { status: 'Reconnected' });
  console.log('MQTT reconnected');
  const devices = await Device.find({});
  devices.forEach(device => {
    if (device.clientId) logDeviceStatus(device.clientId, 'unknown', 'connected', 'MQTT reconnected');
  });
});

client.on('error', async (err) => {
  sendHttpEvent('disconnection', { status: 'Error', message: err.message });
  console.error('MQTT error:', err.message);
});

client.on('offline', async () => {
  sendHttpEvent('disconnection', { status: 'Offline' });
  console.log('MQTT offline');
});

client.on('message', async (topic, message) => {
  const msgStr = message.toString();
  const trimmedTopic = topic.trim();

  const powerMatch = trimmedTopic.match(/^(stat|tele)\/(.+?)\/POWER$/);
  const resultMatch = trimmedTopic.match(/^(stat|tele)\/(.+?)\/RESULT$/);
  const lwtMatch = trimmedTopic.match(/^tele\/(.+?)\/LWT$/);
  const sensorMatch = trimmedTopic.match(/^(stat|tele)\/(.+?)\/SENSOR$/);

  try {
    if (powerMatch) {
      const clientId = powerMatch[2];
      const powerStatus = msgStr.toLowerCase();
      if (['on', 'off'].includes(powerStatus)) {
        await logDeviceStatus(clientId, powerStatus, 'connected', `POWER: ${powerStatus}`);
        await logPowerStatus({ clientId, entity: 'POWER', power: powerStatus });
      }
    } else if (resultMatch) {
      const clientId = resultMatch[2];
      try {
        const resultPayload = JSON.parse(msgStr);
        if (resultPayload.POWER) {
          const powerStatus = resultPayload.POWER.toLowerCase();
          if (['on', 'off'].includes(powerStatus)) {
            await logDeviceStatus(clientId, powerStatus, 'connected', `RESULT POWER: ${powerStatus}`);
          }
        }
      } catch (err) {
        console.error(`Failed to parse RESULT payload:`, err.message);
      }
    } else if (lwtMatch) {
      const clientId = lwtMatch[1];
      const statusPayload = msgStr.toLowerCase();
      const status = statusPayload === 'online' ? 'connected' : 'disconnected';
      await logDeviceStatus(clientId, 'unknown', status, `LWT: ${msgStr}`);
    } else if (sensorMatch) {
      const clientId = sensorMatch[2];
      try {
        const sensorData = JSON.parse(msgStr);
        for (const [entity, data] of Object.entries(sensorData)) {
          if (entity === 'Time') continue;
          if (typeof data === 'object') {
            const sensorEntry = new SensorData({ clientId, entity, data, timestamp: new Date() });
            await sensorEntry.save();
          }
        }
      } catch (err) {
        console.error('❌ SENSOR parse error:', err.message);
      }
    }
  } catch (err) {
    console.error('❗ Message handler error:', err.message);
  }
});

// ///////////////////////////////////////////////////////

async function getConnectedDevices() {
  try {
    const connectedDevices = await DeviceStatusLog.find({ status: 'connected' });
    return {
      success: true,
      count: connectedDevices.length,
      devices: connectedDevices,
    };
  } catch (err) {
    return { success: false, message: 'Failed to fetch connected devices', error: err.message };
  }
}




//////////////////////////////////////////////////////
async function getLatestSensorData(clientId , entity) {
  try {
    const sensor = await SensorData.findOne({ clientId , entity }).sort({ timestamp: -1 });
    const status = await DeviceStatusLog.findOne({ clientId , entity }).sort({ date: -1 });
    if (!sensor && !status) return { success: false, message: 'No data available' };
    return { success: true, data: { sensor, status } };
  } catch (err) {
    return { success: false, message: 'Error retrieving data' };
  }
}

/////////////////////////////////////////////////////

async function sendCommand(clientId, entity) {
  try {
    const device = await Device.findOne({ clientId, entity });
    if (!device) {
      return { success: false, message: 'No device available' };
    }

    const inputTopic = `cmnd/${clientId}/POWER`;
    const message = 'TOGGLE'
    const responseTopic = `stat/${clientId}/RESULT`;

    return await new Promise((resolve, reject) => {
      let timeout;

      const handleMessage = (topic, payload) => {
        if (topic === responseTopic) {
          clearTimeout(timeout);
          client.removeListener('message', handleMessage);
          client.unsubscribe(responseTopic, () => {}); // Clean up subscription

          try {
            const data = JSON.parse(payload.toString());
            resolve({ success: true, message: 'Response received', data });
          } catch (err) {
            resolve({ success: true, message: 'Response received', raw: payload.toString() });
          }
        }
      };

      // Listen for response
      client.on('message', handleMessage);

      // Subscribe to the response topic
      client.subscribe(responseTopic, (err) => {
        if (err) {
          client.removeListener('message', handleMessage);
          return reject({ success: false, message: 'Failed to subscribe to response topic' });
        }

        // Publish the command
        client.publish(inputTopic, message.toUpperCase(), {}, (err) => {
          if (err) {
            client.removeListener('message', handleMessage);
            client.unsubscribe(responseTopic, () => {});
            return reject({ success: false, message: 'Failed to send command', error: err.message });
          }

          // Set timeout for waiting for response
          timeout = setTimeout(() => {
            client.removeListener('message', handleMessage);
            client.unsubscribe(responseTopic, () => {});
            reject({ success: false, message: 'Device did not respond in time' });
          }, 5000); 
        });
      });
    });

  } catch (err) {
    return { success: false, message: 'Error during command sending', error: err.message };
  }
}




//////////////////////////////////////////////////////
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
      topic,
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

////////////////////////////////////////////////////////////////
async function updateAutomationRuleById(ruleId, updateData) {
  const {onTime, offTime, timezone } = updateData;
  try {
    const updated = await Automation.findByIdAndUpdate(
      ruleId,
      { onTime, offTime, timezone },
      { new: true, runValidators: true }
    );
    if (!updated) throw new Error('Rule not found');
    return { success: true, message: 'Rule updated', rule: updated };
  } catch (err) {
    if (err.code === 11000) throw new Error('Duplicate time rule');
    throw err;
  }
}

///////////////////////////////////////////////////////////////////
async function getAutomationRulesByClientId(clientId , entty) {
  const rules = await Automation.find({ clientId , entty});
  return { success: true, count: rules.length, rules };
}

/////////////////////////////////////////////////////////////////
async function deleteAutomationRuleById(ruleId) {
  const deleted = await Automation.findByIdAndDelete(ruleId);
  if (!deleted) return { success: false, message: 'Rule not found' };
  return { success: true, message: 'Rule deleted' };
}

///////////////////////////////////////////////////////////
async function getPowerLogs(accessToken) {
  const { userId, error } = verifyToken(accessToken);
  const devices = await Device.find({ owner: userId });
  const clientIds = devices.map((d) => d.clientId);
  if (clientIds.length === 0) return { success: true, count: 0, logs: [] };
  const logs = await PowerLog.find({ clientId: { $in: clientIds } }).sort({ _id: -1 });
  return { success: true, count: logs.length, logs };
}

/////////////////////////////////////////////////////
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
  getPowerLogs,
  getConnectedDevices,
};