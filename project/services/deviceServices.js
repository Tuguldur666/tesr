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
    if (!phoneNumber) {
      return { success: false, message: 'Phone number is required' };
    }
    if (!accessToken) {
      return { success: false, message: 'Access token is required' };
    }

    const decoded = verifyToken(accessToken);
    if (!decoded || !decoded.userId) {
      return { success: false, message: 'Invalid access token' };
    }
    const userIdFromToken = decoded.userId;

    const normalizedPhone = phoneNumber.trim();

    console.log('Looking for user with phoneNumber:', normalizedPhone);

    const existingUser = await User.findOne({ phoneNumber: normalizedPhone });
    console.log('User found:', existingUser);

    if (!existingUser) {
      return { success: false, message: 'User does not exist' };
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
    console.error('Error in addDeviceToUser:', error);
    return {
      success: false,
      message: 'Error registering device: ' + error.message,
    };
  }
}


////////////////////////////////////////////////////

async function getDevices(accessToken) {
  const { userId, isAdmin, error } = verifyToken(accessToken);
  if (error) return { success: false, message: error };

  const query = isAdmin ? {} : { owner: userId };

  const devices = await Device.find(query);
  return { success: true, devices };
}

////////////////////////////////////////////////////////////////////////////
async function removeUserFromDevice(id, phoneNumber, accessToken) {
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
      { $pull: { owner: existingUser._id } },
      { new: true }
    );

    return {
      success: true,
      message: `User removed from device "${updatedDevice.clientId}, ${updatedDevice.entity}" successfully.`,
      device: updatedDevice,
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error removing user from device: ' + error.message,
    };
  }
}
///////////////////////////////////////////////////////////////////



module.exports = {
  registerDevice,
  getDevices,
  addDeviceToUser,
  removeUserFromDevice,
};
