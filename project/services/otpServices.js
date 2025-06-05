const axios = require('axios');
const Otp = require('../models/otp');
const User = require('../models/user');
require('dotenv').config();


async function sendMessage(userId, phoneNumber, code, authType) {
    console.error("authType in send meassage",authType)
    console.error("phone number in send meassage",phoneNumber)
  try {
    const response = await axios.get(process.env.MESSAGE_API, {
      params: {
        key: process.env.MESSAGE_KEY,
        text: `${code} is your confirmation code for VIOT`,
        to: phoneNumber,
        from: process.env.MESSAGE_PHONE_1,
      },
    });

    console.log('[OTP API Response]:', response.data);

  
    const result = Array.isArray(response.data)
      ? response.data[0]?.Result
      : response.data?.Result;

    if (result === 'SUCCESS') {
      
      await Otp.deleteMany({ userId, authType});

      await Otp.create({ userId, code , authType});
      return true;
    } else {
      console.error('[OTP API Failure]', response.data);
      return false;
    }
  } catch (err) {
    console.error('[sendMessage Error]', err.response?.data || err.message);
    return false;
  }
}



async function verifyUserByOtp({ phoneNumber, code }) {
  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const otpEntry = await Otp.findOne({ userId: user._id, code, authType: 'verify' });
    console.error(otpEntry)
    if (!otpEntry) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    await Otp.deleteMany({ userId: user._id, authType: 'verify' });


    user.isVerified = true;
    await user.save();

    return { success: true, message: 'User verified successfully' };
  } catch (err) {
    console.error('Error verifying OTP:', err);
    return { success: false, message: 'OTP verification failed' };
  }
}

module.exports = {verifyUserByOtp,sendMessage}

