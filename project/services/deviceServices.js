const Device = require('../models/Device');
const mongoose = require('mongoose');
const User = require('../models/user')
const { verifyToken } = require('../utils/token'); 



async function registerDevice(clientId, entity, type) {
  try {
    const existingDevice = await User.findOne({ clientId, entity});
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
async function addDeviceToUser(id, phoneNumber, accessToken) {
  try {
    const decoded = verifyToken(accessToken); 
    const userIdFromToken = decoded.id;

    const existingUser = await User.findOne({ phoneNumber });
    if (!existingUser) {
      return { success: false, message: 'User does not exist' };
    }

    if (existingUser._id.toString() !== userIdFromToken) {
      return { success: false, message: 'Access denied: Token does not match user' };
    }

    const existingDevice = await Device.findById(id);
    if (!existingDevice) {
      return { success: false, message: 'Device does not exist' };
    }

    const updatedDevice = await Device.findByIdAndUpdate(
      id,
      { $addToSet: { owner: existingUser._id } },
      { new: true }
    );

    return {
      success: true,
      message: `Device "${updatedDevice.clientId}, ${updatedDevice.entity}" linked to user successfully.`,
      device: updatedDevice,
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error registering device: ' + error.message,
    };
  }
}

////////////////////////////////////////////////////


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
  addDeviceToUser,
};
