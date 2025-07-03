const axios = require('axios');
const Otp = require('../models/otp');
const User = require('../models/user');
require('dotenv').config();


async function sendMessage(userId, phoneNumber, code, authType) {
  console.log("authType in sendMessage:", authType);
  console.log("phoneNumber in sendMessage:", phoneNumber);

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
      await Otp.deleteMany({ userId, authType });
      console.log('[OTP DELETE] Existing codes removed');

      try {
        const otpDoc = await Otp.create({ userId, code, authType });
        console.log('[OTP CREATED]', otpDoc);
      } catch (createErr) {
        console.error('[OTP CREATE ERROR]', createErr);
        return false;
      }

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

// ////////////////////////////////////////////////////////////////////


async function verifyUserByOtp({ phoneNumber, code }) {
  try {
    const user = await User.findOne({ phoneNumber }).sort({ createdAt: -1 });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if (user.isVerified) {
      return { success: true, message: 'User is already verified' };
    }

    const otpEntry = await Otp.findOne({
      userId: user._id,
      code,
      authType: 'verify',
    });

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

// /////////////////////////////////////////////////


async function forgotPassword({ phoneNumber }) {
  try {
    const user = await User.findOne({ phoneNumber, isVerified: true });
    if (!user) {
      return { success: false, message: 'Verified user with this phone number not found' };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const otpSent = await sendMessage(user._id, phoneNumber, otpCode, 'reset');
    if (!otpSent) {
      return {
        success: false,
        message: 'Failed to send OTP. Please try again later.',
      };
    }

    return {
      success: true,
      message: 'OTP sent successfully for password reset',
    };

  } catch (err) {
    console.error('Error in forgotPassword:', err);
    return {
      success: false,
      message: 'Failed to initiate password reset',
    };
  }
}


// //////////////////////////////////////////////////////////////


async function verifyResetOtp({ phoneNumber, code }) {
  try {

    const user = await User.findOne({ phoneNumber, isVerified: true })

    if (!user) {
      return { success: false, message: 'Verified user not found' };
    }

    const otpEntry = await Otp.findOne({
      userId: user._id,
      code,
      authType: 'reset'
    });

    if (!otpEntry) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    await Otp.deleteMany({ userId: user._id, authType: 'reset' });

    return {
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
      userId: user._id
    };

  } catch (err) {
    console.error('Error verifying reset OTP:', err);
    return { success: false, message: 'OTP verification failed' };
  }
}

// /////////////////////////////////////////////////


async function resetPass({ phoneNumber, newPassword }) {
  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if (!user.isVerified) {
      return {
        success: false,
        message: 'User is not verified. Password reset is not allowed.'
      };
    }

    user.password = newPassword;
    await user.save();

    return {
      success: true,
      message: 'Password reset successfully'
    };
  } catch (err) {

    console.error('Error resetting password:', err);
    
    return {
      success: false,
      message: 'Failed to reset password'
    };
  }
}

/////////////////////////////////////////

async function verifyChangePhoneOtp({ userId, code, authType }) {
  if (!['change_old', 'change_new'].includes(authType)) {
    return { success: false, message: 'Invalid authType for phone change' };
  }

  try {
    const otpEntry = await Otp.findOne({
      userId,
      code,
      authType,
    });

    if (!otpEntry) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    await Otp.deleteMany({ userId, authType });

    return {
      success: true,
      message: 'OTP verified successfully',
    };
  } catch (err) {
    console.error('Error verifying phone change OTP:', err);
    return { success: false, message: 'Failed to verify OTP' };
  }
}
/////////////////////////////////////////////////////////

async function sendChangePhoneOtp(userId, phoneNumber, authType) {
  if (!['change_old', 'change_new'].includes(authType)) {
    return { success: false, message: 'Invalid authType for phone change' };
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const sent = await sendMessage(userId, phoneNumber, otpCode, authType);

  if (!sent) {
    return {
      success: false,
      message: `Failed to send OTP to ${authType === 'change_old' ? 'current' : 'new'} phone`,
    };
  }

  return {
    success: true,
    message: `OTP sent to ${authType === 'change_old' ? 'current' : 'new'} phone number`,
  };
}



module.exports = {
  verifyUserByOtp,
  sendMessage,
  forgotPassword,
  verifyResetOtp,
  resetPass,
  verifyChangePhoneOtp,
  sendChangePhoneOtp
}

