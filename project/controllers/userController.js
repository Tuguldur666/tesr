const service = require('../services/userServices')


exports.registerUser = async (req, res) => {
  /*
  #swagger.tags = ['Users']
  #swagger.summary = 'User Registration'
  #swagger.description = 'Registers a new user with name, phoneNumber, and password'
  #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
          name: "tuuguu",
          phoneNumber: 99881175,
          password: "1234"
      }
  }
  */

  try {
    const { name, phoneNumber, password } = req.body;

    if (!name || !phoneNumber || !password) {
      return res.status(422).json({
        success: false,
        message: "Missing required fields: name, phoneNumber, or password",
      });
    }

    const result = await service.registerUser({ name, phoneNumber, password });

    if (result.success) {
      const { accessToken, refreshToken } = result;

      res.set('x-refresh-token', refreshToken);

      return res.status(201).json({
        success: true,
        message: result.message,
        accessToken,
      });
    } else {
      return res.status(409).json({
        success: false,
        message: result.message || "User already exists",
      });
    }

  } catch (err) {
    console.error("Registration service failure:", err.message);

    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    });
  }
};


// /////////////////////////////////////
exports.login = async (req, res) => {
  /*
  #swagger.tags = ['Users']
  #swagger.summary = 'User login'
  #swagger.description = 'Logs in a user with phoneNumber and password'
  #swagger.parameters['body'] = {
    in: 'body',
    required: true,
    schema: {
      phoneNumber: "99881175",
      password: "1234"
    }
  }
  */

  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(422).json({
      success: false,
      message: "Missing phoneNumber or password",
    });
  }

  try {
    const result = await service.loginUser({ phoneNumber, password });
    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.message || "Invalid credentials",
      });
    }

    const { accessToken, refreshToken } = result;

    res.set('x-refresh-token', refreshToken);

    return res.status(200).json({
      success: true,
      message: result.message,
      accessToken,
    });

  } catch (err) {
    console.error("Login service error:", err.message);
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    });
  }
};


// //////////////////////////////////////////
exports.refreshToken = async (req, res) => {
  /*
  #swagger.tags = ['Users']
  #swagger.summary = 'Refresh access token'
  #swagger.description = 'Returns a new access token using the refresh token'
  #swagger.parameters['x-refresh-token'] = {
    in: 'header',
    description: 'Refresh token (optional for Swagger testing)',
    required: false,
    type: 'string'
  }
  */

  try {
    const result = await service.refreshToken(req);

    if (!result.success) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(result.status).json({ success: true, accessToken: result.accessToken });

  } catch (err) {
    console.error('Unexpected error in refreshToken controller:', err);
    return res.status(503).json({ success: false, message: 'Internal server error' });
  }
};

////////////////////////////////////////////




exports.updateUsername = async (req, res) => {
  /*
    #swagger.tags = ['Users']
    #swagger.summary = 'Update username'
    #swagger.description = 'Updates the user name using access token authentication.'
    #swagger.parameters['Authorization'] = {
      in: 'header',
      name: 'Authorization',
      required: true,
      description: 'Bearer access token',
      type: 'string',
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        newName: "Tuuguu"
      }
    }
  */

  const authHeader = req.headers.authorization;
  const { newName } = req.body;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  if (!newName) {
    return res.status(422).json({ success: false, message: 'New name is required' });
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    const result = await service.updateUsername({ accessToken, newName });
    return res.status(result.status || 200).json(result);
  } catch (err) {
    console.error('Error in updateUsername controller:', err);
    return res.status(503).json({ success: false, message: 'Service temporarily unavailable' , error: err.message});
  }
};


////////////////////////////////////////////
exports.getUserData = async (req, res) => {
  /*
    #swagger.tags = ['Users']
    #swagger.summary = 'Get user data'
    #swagger.description = 'Returns user details from access token. Token is passed in the Authorization header.'
    #swagger.parameters['Authorization'] = {
      in: 'header',
      name: 'Authorization',
      description: 'Bearer access token',
      required: true,
      type: 'string',
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
  */

  try {
    const result = await service.getUserData(req);

    if (!result.success) {
      return res.status(result.status || 401).json({
        success: false,
        message: result.message || "Unauthorized or token invalid",
      });
    }

    return res.status(result.status || 200).json({
      success: true,
      user: result.user,
    });

  } catch (err) {
    console.error("getUserData error:", err.message);

    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    });
  }
};
//////////////////////////////////////////////////////////////////////////





