const User = require('../models/user');
const Device = require('../models/Device');
const otp = require('./otpServices');
const jwt = require('jsonwebtoken');



async function registerUser({ name,phoneNumber, password }) {
  try {
    const verifiedPhoneUser = await User.findOne({ phoneNumber, isVerified: true });

    console.error(verifiedPhoneUser)

    if (verifiedPhoneUser) {
      return { success: false, message: 'User already exists with this email or phone number' };
    }

    const existingUnverifiedUser = await User.findOne({
      isVerified: false,
      $or: [{ phoneNumber }]

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
    console.error('Error in registerUser:', err);
    return {
      success: false,
      message: 'Registration failed due to server error',
    };
  }
}



///////////////////////////////////////////////

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

////////////////////////////////////////////////////////
async function updateUsername({ accessToken, newName }) {
  
  if (!accessToken || !newName) {
    return {
      success: false,
      message: 'User ID and new name are required',
    };
  }

  const { userId, error } = verifyToken(accessToken);

  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
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

  const refreshToken = req.cookies?.jwt;
  console.log('Refresh token from cookie:', refreshToken);

  if (!refreshToken) {
    console.log('No refresh token provided');
    return { success: false, status: 401, message: 'Refresh token missing' };
  }
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log('Decoded token:', decoded);

    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('User not found for id:', decoded.id);
      return { success: false, status: 403, message: 'User not found' };
    }

    const newAccessToken = user.generateAccessToken();
    console.log('New access token generated');

    return {
      success: true,
      status: 200,
      accessToken: newAccessToken
    };
  } catch (err) {

    console.error('Refresh error:', err);

    return { success: false, status: 403, message: 'Invalid or expired refresh token' };
  }
}
// //////////////////////////////////////////


async function getUserData(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, status: 401, message: 'Access token missing or malformed' };
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log('🔐 Decoded access token:', decoded);

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
        email: user.email,
      }
    };
  } catch (err) {
    console.error('❗ Access token error:', err);
    return { success: false, status: 403, message: 'Invalid or expired access token' };
  }
}




module.exports = { registerUser, loginUser, refreshToken ,getUserData,updateUsername}

