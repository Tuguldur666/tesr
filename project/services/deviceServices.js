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

async function addDeviceToUser(id, phoneNumber, customName, accessToken) {
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

    const requestingUser = await User.findById(userIdFromToken);
    if (!requestingUser) {
      return { success: false, message: 'Requesting user not found' };
    }

    const normalizedPhone = phoneNumber.trim();
    const existingUser = await User.findOne({ phoneNumber: normalizedPhone });
    if (!existingUser) {
      return { success: false, message: 'User does not exist' };
    }

    const device = await Device.findById(id);
    if (!device) {
      return { success: false, message: 'Device does not exist' };
    }

    const isAlreadyOwner = device.owner.some(
      (entry) => entry.userId?.toString?.() === existingUser._id.toString()
    );

    if (isAlreadyOwner) {
      return {
        success: true,
        message: `User is already linked to device "${device.clientId}, ${device.entity}".`,
        device,
      };
    }

    const isRequestingUserOwner = device.owner.some(
      (entry) => entry.userId?.toString?.() === userIdFromToken
    );

    if (!isRequestingUserOwner && !requestingUser.isAdmin) {
      return {
        success: false,
        message: 'You are not authorized to add users to this device',
      };
    }

    device.owner.push({
      userId: existingUser._id,
      addedBy: userIdFromToken,
      name: customName,
    });

    const updatedDevice = await device.save();

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

  const query = isAdmin
    ? {}
    : { "owner.userId": new mongoose.Types.ObjectId(userId) }; 

  const devices = await Device.find(query);
  return { success: true, devices };
}

////////////////////////////////////////////////////////////////////////////

async function removeUserFromDevice(id, phoneNumber, accessToken) {
  try {
    if (!accessToken) {
      return { success: false, message: 'Access token is required' };
    }
    if (!phoneNumber) {
      return { success: false, message: 'Phone number is required' };
    }

    const decoded = verifyToken(accessToken);
    if (!decoded || !decoded.userId) {
      return { success: false, message: 'Invalid access token' };
    }

    const requestingUserId = decoded.userId;
    const isAdmin = decoded.isAdmin === true;
    const normalizedPhone = phoneNumber.toString().trim();

    const existingUser = await User.findOne({ phoneNumber: normalizedPhone });
    if (!existingUser) {
      return { success: false, message: 'User does not exist' };
    }

    const device = await Device.findById(id);
    if (!device) {
      return { success: false, message: 'Device does not exist' };
    }

    const ownerEntry = device.owner.find(
      (o) => o.userId.toString() === existingUser._id.toString()
    );

    if (!ownerEntry) {
      return { success: false, message: 'User is not linked to this device' };
    }

    if (
      !isAdmin &&
      ownerEntry.addedBy?.toString() !== requestingUserId &&
      ownerEntry.userId.toString() !== requestingUserId
    ) {
      return {
        success: false,
        message: 'Access denied: you can only remove yourself and users you added',
      };
    }

    const toRemove = new Set();
    const queue = [existingUser._id.toString()];

    while (queue.length > 0) {
      const currentUserId = queue.shift();
      toRemove.add(currentUserId);

      device.owner.forEach((entry) => {
        if (
          entry.addedBy?.toString() === currentUserId &&
          !toRemove.has(entry.userId.toString())
        ) {
          queue.push(entry.userId.toString());
        }
      });
    }

    device.owner = device.owner.filter(
      (entry) => !toRemove.has(entry.userId.toString())
    );

    const updatedDevice = await device.save();

    return {
      success: true,
      message: `User and all users added by them have been removed from device "${updatedDevice.clientId}, ${updatedDevice.entity}" successfully.`,
      removedUserIds: Array.from(toRemove),
      device: updatedDevice,
    };

  } catch (error) {
    console.error('Error removing user from device:', error);
    return {
      success: false,
      message: 'Error removing user from device: ' + error.message,
    };
  }
}



///////////////////////////////////////////////////////////////////

async function getDeviceOwnersPhoneNumbers(deviceId, accessToken) {
  try {

    const decoded = verifyToken(accessToken);
    if (!decoded || !decoded.userId) {
      return { success: false, message: 'Invalid or missing access token' };
    }

    const currentUserId = decoded.userId;
    const isAdmin = decoded.isAdmin === true;

    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return { success: false, message: 'Invalid device ID format' };
    }

    const device = await Device.findById(deviceId).populate('owner.userId', 'phoneNumber name');
    if (!device) {
      return { success: false, message: 'Device not found' };
    }

    if (isAdmin) {
      const owners = device.owner
        .filter((entry) => entry.userId)
        .map((entry) => ({
          userId: entry.userId._id,
          phoneNumber: entry.userId.phoneNumber,
          name: entry.userId.name || null,
        }));

      return { success: true, owners };
    }

    const isLinked = device.owner.some((entry) => entry.userId && entry.userId._id.toString() === currentUserId);
    if (!isLinked) {
      return { success: false, message: 'Access denied: you are not linked to this device' };
    }

    const owners = device.owner
      .filter((entry) => {
        const addedBy = entry.addedBy?.toString?.();
        const userId = entry.userId?._id?.toString?.();
        return userId === currentUserId || addedBy === currentUserId;
      })
      .map((entry) => ({
        userId: entry.userId._id,
        phoneNumber: entry.userId.phoneNumber,
        name: entry.userId.name || null,
      }));

    return { success: true, owners };
  } catch (error) {
    console.error('Error fetching device owners:', error);
    return {
      success: false,
      message: 'Error fetching device owners: ' + error.message,
    };
  }
}



module.exports = {
  registerDevice,
  getDevices,
  addDeviceToUser,
  removeUserFromDevice,
  getDeviceOwnersPhoneNumbers,
};
