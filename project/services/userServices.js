const User = require('../models/user');
const otp = require('./otpServices');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/token');




async function registerUser({ name, phoneNumber, password }) {
  try {
    const verifiedPhoneUser = await User.findOne({ phoneNumber, isVerified: true });
    if (verifiedPhoneUser) {
      return { success: false, message: 'User already exists with this phone number' };
    }

    const existingUnverifiedUser = await User.findOne({
      isVerified: false,
      phoneNumber
    }).sort({ createdAt: -1 });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    let userToSave;

    if (existingUnverifiedUser) {
      existingUnverifiedUser.name = name;
      existingUnverifiedUser.phoneNumber = phoneNumber;
      existingUnverifiedUser.password = password;
      userToSave = existingUnverifiedUser;
    } else {
      userToSave = new User({ name, phoneNumber, password });
    }

    await userToSave.save();

    const otpSent = await otp.sendMessage(userToSave._id, phoneNumber, otpCode, 'verify');
    if (!otpSent) {
      return {
        success: false,
        message: 'Failed to send OTP. Registration aborted.',
      };
    }

    const accessToken = userToSave.generateAccessToken();
    const refreshToken = userToSave.generateReshreshToken();

    return {
      success: true,
      message: 'User registered successfully. OTP sent.',
      accessToken,
      refreshToken,
    };
  } catch (err) {
    console.error('❌ Error in registerUser:', err);
    return {
      success: false,
      message: 'Registration failed due to server error',
    };
  }
}
/////////////////////////////////////////////////////////

async function loginUser({ phoneNumber, password }) {
  try {
    const existingUser = await User.findOne({ phoneNumber });
    if (!existingUser) {
      return { success: false, message: 'Invalid phone number or password' };
    }

    const isMatch = await existingUser.comparePassword(password);
    if (!isMatch) {
      return { success: false, message: 'Invalid phone number or password' };
    }

    if (!existingUser.isVerified) {
      return { success: false, message: 'User not verified. Please verify your account first.' };
    }

    const accessToken = existingUser.generateAccessToken();
    const refreshToken = existingUser.generateReshreshToken();

    return {
      success: true,
      message: 'Successful login',
      accessToken,
      refreshToken,
    };
  } catch (err) {
    console.error('Error in login:', err);
    return { success: false, message: 'Login failed' };
  }
}
///////////////////////////////////////////////////////////

async function updateUsername({ accessToken, newName }) {
  if (!accessToken || !newName) {
    return {
      success: false,
      message: 'User ID and new name are required',
    };
  }

  const { userId, error } = verifyToken(accessToken);
  if (error) return { success: false, message: 'Invalid access token' };

  try {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    user.name = newName;
    await user.save();

    return {
      success: true,
      message: 'Username updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      }
    };
  } catch (err) {
    console.error('Error updating username:', err);
    return {
      success: false,
      message: 'Failed to update username. Please try again later.',
    };
  }
}
/////////////////////////////////////////////////////////

async function refreshToken(req) {
  const refreshToken = req.headers['x-refresh-token'];
  if (!refreshToken) {
    return { success: false, status: 401, message: 'Refresh token missing' };
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return { success: false, status: 403, message: 'User not found' };
    }

    const newAccessToken = user.generateAccessToken();
    return {
      success: true,
      status: 200,
      accessToken: newAccessToken
    };
  } catch (err) {
    return { success: false, status: 403, message: 'Invalid or expired refresh token' };
  }
}
//////////////////////////////////////////

async function getUserData(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, status: 401, message: 'Access token missing or malformed' };
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return { success: false, status: 404, message: 'User not found' };
    }

    return {
      success: true,
      status: 200,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin
      }
    };
  } catch (err) {
    return { success: false, status: 403, message: 'Invalid or expired access token' };
  }
}
/////////////////////////////////////////////////////////

async function initiatePhoneNumberChange(accessToken) {
  const { userId, error } = verifyToken(accessToken);
  if (error) return { success: false, message: 'Invalid access token' };

  const user = await User.findById(userId);
  if (!user) return { success: false, message: 'User not found' };

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpSent = await otp.sendMessage(user._id, user.phoneNumber, otpCode, 'change_old');

  console.log('[SERVICE] otpSent flag:', otpSent);

  if (!otpSent) {
    console.log('[SERVICE] About to return failure');
    return { success: false, message: 'Failed to send OTP to current number' };
  }

  console.log('[SERVICE] About to return success');
  return {
    success: true,
    message: 'OTP sent to current phone number. Please verify.',
  };
}

////////////////////////////////////////////////////////////////////////////////////////////////

async function verifyCurrentNumberAndSendOtpToNew(accessToken, enteredOtp, newPhoneNumber) {
    const decoded = verifyToken(accessToken);
    if (!decoded || !decoded.userId) {
      return { success: false, message: 'Invalid access token' };
    }

  const user = await User.findById(decoded.userId);
  if (!user) return { success: false, message: 'User not found' };

  const isValidOtp = await otp.verifyChangePhoneOtp({
    userId: user._id,
    code: enteredOtp,
    authType: 'change_old'
  });

  if (!isValidOtp.success) {
    return { success: false, message: 'Invalid OTP for current number' };
  }

  const existingUser = await User.findOne({ phoneNumber: newPhoneNumber, isVerified: true });
  if (existingUser) {
    return { success: false, message: 'Phone number already in use by another user' };
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpSent = await otp.sendMessage(user._id, newPhoneNumber, otpCode, 'change_new');

  if (!otpSent) {
    return { success: false, message: 'Failed to send OTP to new phone number' };
  }

  return {
    success: true,
    message: 'OTP sent to new phone number. Please verify.',
  };
}
/////////////////////////////////////////////////////////////////////////////////
async function confirmNewPhoneNumber(accessToken, newPhoneNumber, enteredOtp) {
   const decoded = verifyToken(accessToken);
    if (!decoded || !decoded.userId) {
      return { success: false, message: 'Invalid access token' };
    }

  const user = await User.findById(decoded.userId);
  if (!user) return { success: false, message: 'User not found' };

  const existing = await User.findOne({
    phoneNumber: newPhoneNumber,
    isVerified: true,
    _id: { $ne: decoded.userId }
  });
  if (existing) return { success: false, message: 'Phone number already in use' };

  const isValidOtp = await otp.verifyChangePhoneOtp({
    userId: user._id,
    code: enteredOtp,
    authType: 'change_new'
  });
  if (!isValidOtp.success) return { success: false, message: 'Invalid OTP for new number' };

  const update = await User.updateOne(
    { _id: user._id },
    { $set: { phoneNumber: newPhoneNumber } }
  );

  if (update.modifiedCount === 0) {
    return { success: false, message: 'Phone number not updated' };
  }

  return {
    success: true,
    message: 'Phone number updated successfully',
    user: {
      id: user._id,
      name: user.name,
      phoneNumber: newPhoneNumber
    }
  };
}


module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  getUserData,
  updateUsername,
  initiatePhoneNumberChange,
  verifyCurrentNumberAndSendOtpToNew,
  confirmNewPhoneNumber
};
