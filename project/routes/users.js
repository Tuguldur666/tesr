const express = require('express');
const router = express.Router();
const { registerUser,loginUser , refreshToken,getUserData} = require('../services/userService');




router.get('/', (req, res) => {
  res.send('User route working');
});

router.post('/register', async (req, res) => {
  /*
  #swagger.tags = ['Users']
  #swagger.summary = 'User Registration'
  #swagger.description = 'Registers a new user with name, email, and password'
  #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
          name: "tuuguu",
          email: "tuuguu@gmail.com",
          password: "1234"
      }
  }
  */

  const { name, email, password } = req.body;
  const result = await registerUser({ name, email, password });

  if (result.success) {
    const { accessToken, refreshToken } = result;

    // Set refresh token cookie securely
    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: true, // Use HTTPS in production
      sameSite: 'None', // Allows cross-site cookie in modern browsers
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return res.status(200).json({
      message: result.message,
      accessToken,
    });
  } else {
    return res.status(400).json({ message: result.message });
  }
});

router.post('/login', async (req, res) => {

  /*
  #swagger.tags = ['Users']
  #swagger.summary = 'User login'
  #swagger.description = 'Logs in a user with email and password'
  #swagger.parameters['body'] = {
    in: 'body',
    required: true,
    schema: {
      email: "apoxmn@gmail.com",
      password: "1234"
    }
  }
*/

  const { email, password } = req.body;

  try {
    const result = await loginUser({ email, password });

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    const { accessToken, refreshToken } = result;


    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: 'None',
      maxAge: 24 * 60 * 60 * 1000 
    });

    return res.status(200).json({
      message: result.message,
      accessToken
    });

  } catch (err) {
    console.error('Login route error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
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

  const result = await refreshToken(req);

  if (!result.success) {
    return res.status(result.status).json({ message: result.message });
  }

  return res.status(result.status).json({ accessToken: result.accessToken });
});


// //////////////////////////////////

router.get('/getuser', async (req, res) => {
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

  const result = await getUserData(req);

  if (!result.success) {
    return res.status(result.status).json({ message: result.message });
  }

  return res.status(result.status).json({ user: result.user });
});




module.exports = router;


