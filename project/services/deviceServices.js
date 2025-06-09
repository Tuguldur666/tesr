const Device = require('../models/Device');
const SensorData = require('../models/data'); 

function generateTopics(deviceId) {
  return {
    sensor: `tele/${deviceId}/SENSOR`,
    status: `tele/${deviceId}/STATUS`,
    statusCommand: `cmnd/${deviceId}/STATUS`,
  };
}

/**

 * @param {string} deviceId
 * @param {string} category 
 * @param {string} type
 * @param {object} metadata
 * @returns {Promise<{success: boolean, message?: string, device?: object}>}
 */
async function registerDevice(deviceId, category, type, metadata = {}) {
  try {
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return { success: false, message: 'Device already registered' };
    }

    const topics = generateTopics(deviceId);

    const device = new Device({
      deviceId,
      category,
      type,
      topics,
      metadata,
    });

    await device.save();

    return {
      success: true,
      message: `Device "${deviceId}" registered successfully.`,
      device,
    };
  } catch (error) {
    return { success: false, message: 'Error registering device: ' + error.message };
  }
}

/**

 * @returns {Promise<Array>}
 */
async function getAllDevices() {
  return await Device.find({});
}

/**

 * @param {string} deviceId
 * @returns {Promise<Object|null>}
 */
async function getDevice(deviceId) {
  return await Device.findOne({ deviceId });
}

/**

 * @param {string} category
 * @returns {Promise<Array>}
 */
async function getDevicesByCategory(category) {
  return await Device.find({ category });
}

/**

 * @param {string} deviceId
 * @param {object} updateFields 
 * @returns {Promise<{success: boolean, message: string, device?: object}>}
 */
async function updateDevice(deviceId, updateFields) {
  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return { success: false, message: `Device "${deviceId}" not found` };
    }

    if (updateFields.type !== undefined) device.type = updateFields.type;
    if (updateFields.metadata !== undefined) device.metadata = updateFields.metadata;

    await device.save();

    return { success: true, message: `Device "${deviceId}" updated successfully.`, device };
  } catch (error) {
    return { success: false, message: 'Error updating device: ' + error.message };
  }
}

/**
 * @param {string} deviceId
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function unregisterDevice(deviceId) {
  const deleted = await Device.deleteOne({ deviceId });
  if (deleted.deletedCount === 0) {
    return { success: false, message: `Device "${deviceId}" not found` };
  }
  return { success: true, message: `Device "${deviceId}" unregistered successfully.` };
}

module.exports = {
  registerDevice,
  getAllDevices,
  getDevice,
  getDevicesByCategory,
  updateDevice,
  unregisterDevice,
};
