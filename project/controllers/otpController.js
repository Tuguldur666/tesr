const optService = require('../services/otpServices')


exports.verifyUser = async (req, res) => {

      /*
  #swagger.tags = ['Users']
  #swagger.summary = 'User login'
  #swagger.description = 'Logs in a user with email and password'
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
    return res.status(400).json({
      success: false,
      message: 'Phone number and OTP code are required',
    });
  }

  try {
    const result = await optService.verifyUserByOtp({ phoneNumber, code });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Controller error in verifyUser:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying user',
    });
  }
};


exports.forgotPass = async (req, res) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Send OTP for password reset'
    #swagger.description = 'Sends a 6-digit OTP to the user’s registered phone number for password reset.'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        phoneNumber: 99881175
      }
    }
  */

  const { phoneNumber } = req.body;

  const result = await optService.forgotPassword({ phoneNumber });

  res.status(result.success ? 200 : 400).json(result);
};
// /////////////////////////////////////////


exports.verifyResetOtp = async (req, res) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Send OTP for password reset'
    #swagger.description = 'Sends a 6-digit OTP to the user’s registered phone number for password reset.'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        phoneNumber:99881175,
        code: "dsfsdfsd"

      }
    }
  */

  const { phoneNumber,code } = req.body;

  const result = await optService.verifyResetOtp({ phoneNumber , code});

  res.status(result.success ? 200 : 400).json(result);
};
// ///////////////////////////////////////////////

exports.resetPass = async(req,res) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Send OTP for password reset'
    #swagger.description = 'Sends a 6-digit OTP to the user’s registered phone number for password reset.'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        phoneNumber:99881175,
        newPassword:"sdfsdfdf"

      }
    }
  */

  const { phoneNumber, newPassword} = req.body;

  const result = await optService.verifyResetOtp({ phoneNumber , newPassword});

  res.status(result.success ? 200 : 400).json(result);
};
