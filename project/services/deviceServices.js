const Device = require('../models/Device');
const SensorData = require('../models/data'); 
const mongoose = require('mongoose');


function generateTopics(clientId) {
  return {
    sensor: `tele/${clientId}/SENSOR`,
    status: `tele/${clientId}/STATUS`,
    statusCommand: `cmnd/${clientId}/STATUS`,
  };
}

/**

 * @param {string} clientId
 * @param {string} entity
 * @param {string} category 
 * @param {string} type
 * @param {object} metadata
 * @returns {Promise<{success: boolean, message?: string, device?: object}>}
 */
async function registerDevice(clientId, entity ,category, type, metadata = {},userId) {
  try {
    const existingDevice = await Device.findOne({ clientId });
    if (existingDevice) {
      return { success: false, message: 'Device already registered' };
    }

    const topics = generateTopics(clientId);

    const device = new Device({
      clientId,
      entity,
      category,
      type,
      topics,
      metadata,
      userId,
      owner: new mongoose.Types.ObjectId(userId),
    });

    await device.save();

    return {
      success: true,
      message: `Device "${clientId}" registered successfully.`,
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

 * @param {string} clientId
 * @returns {Promise<Object|null>}
 */
async function getDevice(clientId) {
  return await Device.findOne({ clientId });
}

/**

 * @param {string} category
 * @returns {Promise<Array>}
 */
async function getDevicesByCategory(category) {
  return await Device.find({ category });
}

/**

 * @param {string} clientId
 * @param {object} updateFields 
 * @returns {Promise<{success: boolean, message: string, device?: object}>}
 */
async function updateDevice(clientId, updateFields) {
  try {
    const device = await Device.findOne({ clientId });
    if (!device) {
      return { success: false, message: `Device "${clientId}" not found` };
    }

    if (updateFields.type !== undefined) device.type = updateFields.type;
    if (updateFields.metadata !== undefined) device.metadata = updateFields.metadata;

    await device.save();

    return { success: true, message: `Device "${clientId}" updated successfully.`, device };
  } catch (error) {
    return { success: false, message: 'Error updating device: ' + error.message };
  }
}

/**
 * @param {string} clientId
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function unregisterDevice(clientId) {
  const deleted = await Device.deleteOne({ clientId });
  if (deleted.deletedCount === 0) {
    return { success: false, message: `Device "${clientId}" not found` };
  }
  return { success: true, message: `Device "${clientId}" unregistered successfully.` };
}

module.exports = {
  registerDevice,
  getAllDevices,
  getDevice,
  getDevicesByCategory,
  updateDevice,
  unregisterDevice,
};
