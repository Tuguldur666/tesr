const Device = require('../models/Device');
const SensorData = require('../models/data'); 
const mongoose = require('mongoose');
const { verifyToken } = require('../utils/token'); 



async function registerDevice(clientId, entity, type) {
  try {
    const existingDevice = await Device.findOne({ clientId, entity});
    if (existingDevice) {
      return { success: false, message: 'Device already registered' };
    }

    const device = new Device({
      clientId,
      entity,
      type,
      owner: [],
      status: 'disconnected',       
      message: '',                   
      lastUpdated: new Date(),       
    });

    await device.save();

    return {
      success: true,
      message: `Device "${clientId}, ${entity}" registered successfully.`,
      device,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error registering device: ' + error.message,
    };
  }
}


/////////////////////////////////////////////////////////////////////////



async function getDevices(accessToken, req) {
  const { userId, error } = verifyToken(accessToken);
  if (error) return { success: false, message: error };

  const filter = req?.query || {}; 
  const query = { owner: userId };

  if (filter.clientId) query.clientId = filter.clientId;
  if (filter.entity) query.entity = filter.entity;

  const devices = await Device.find(query);
  return { success: true, devices };
}

////////////////////////////////////////////////////////////////////////////

async function unregisterDevice(accessToken, clientId, entity) {
  const { userId, error } = verifyToken(accessToken);
  if (error) return { success: false, message: error };

  const query = { owner: userId };
  if (clientId) query.clientId = clientId;
  if (entity) query.entity = entity;

  const deleted = await Device.deleteOne(query);

  if (deleted.deletedCount === 0) {
    return { success: false, message: 'Device not found or already deleted' };
  }

  return { success: true, message: `Device "${clientId}" unregistered successfully.` };
}

////////////////////////////////////////


module.exports = {
  registerDevice,
  getDevices,
  unregisterDevice,
};
