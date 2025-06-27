const optService = require('../services/otpServices')


exports.verifyUser = async (req, res) => {
  /*
  #swagger.tags = ['Users']
  #swagger.summary = 'Verify user via OTP'
  #swagger.description = 'Verifies a user by phone number and OTP code'
  #swagger.parameters['body'] = {
    in: 'body',
    required: true,
    schema: {
      phoneNumber: 99881175,
      code: "712329"
    }
  }
  */

  const { phoneNumber, code } = req.body;

  if (!phoneNumber || !code) {
    return res.status(422).json({
      success: false,
      message: 'Phone number and OTP code are required',
    });
  }

  try {
    const result = await optService.verifyUserByOtp({ phoneNumber, code });

    if (result.success) {
      return res.status(200).json(result);
    }

    return res.status(401).json({
      success: false,
      message: result.message || "Invalid or expired OTP code",
    });

  } catch (err) {
    console.error('Controller error in verifyUser:', err);

    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.',
    });
  }
};

////////////////////////////////////////////////////////////////

exports.forgotPass = async (req, res) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Send OTP for password reset'
    #swagger.description = 'Sends a 6-digit OTP to the provided phone number'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        phoneNumber: 99881175
      }
    }
  */

  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(422).json({
      success: false,
      message: 'Phone number is required',
    });
  }

  try {
    console.log("Received phone number (type and value):", typeof phoneNumber, phoneNumber);

    const result = await optService.forgotPassword({ phoneNumber });

    return res.status(result.success ? 200 : 400).json(result);

  } catch (err) {
    console.error("Error in forgotPass controller:", err);

    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.',
    });
  }
};

// ////////////////////////////////////////////////////////

exports.verifyResetOtp = async (req, res) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Verify OTP for password reset'
    #swagger.description = 'Verifies a 6-digit OTP sent to the user’s registered phone number for password reset.'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        phoneNumber: 99881175,
        code: "712329"
      }
    }
  */

  const { phoneNumber, code } = req.body;

  if (!phoneNumber || !code) {
    return res.status(422).json({
      success: false,
      message: 'Phone number and OTP code are required',
    });
  }
  try {
    const result = await optService.verifyResetOtp({ phoneNumber, code });

    if (result.success) {
      return res.status(200).json(result);
    }
    return res.status(401).json({
      success: false,
      message: result.message || 'Invalid or expired OTP code',
    });
  } catch (err) {
    console.error("verifyResetOtp controller error:", err);

    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.',
    });
  }
};

// ///////////////////////////////////////////////

exports.resetPass = async (req, res) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Reset password'
    #swagger.description = 'Resets the user’s password after OTP verification.'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        phoneNumber: 99881175,
        newPassword: "newStrongPassword123"
      }
    }
  */

  const { phoneNumber, newPassword } = req.body;

  if (!phoneNumber || !newPassword) {
    return res.status(422).json({
      success: false,
      message: 'Phone number and new password are required',
    });
  }

  try {
    const result = await optService.resetPass({ phoneNumber, newPassword });

    if (result.success) {
      return res.status(200).json(result);
    }

    return res.status(400).json({
      success: false,
      message: result.message || 'Password reset failed',
    });

  } catch (err) {
    console.error('resetPass controller error:', err);

    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.',
    });
  }
};

