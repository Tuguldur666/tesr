const express = require('express');
const router = express.Router();
const { registerUser,loginUser } = require('../services/userService');


router.get('/', (req, res) => {
  res.send('User route working');
});

router.post('/register', async (req, res) => {
    /*
    #swagger.tags = ['Users']
    #swagger.summary = 'Some summary...'
    #swagger.description = 'Some description...'
    #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            name: " gg",
            email: "GGG",
            password: "1234"
        }
    }
    */

  const { name, email, password } = req.body;

  const result = await registerUser({ name, email, password });

  if (result.success) {
    res.status(200).json(result.user);
  } else {
    res.status(400).json({ message: result.message });
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
      email: "GGG",
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

    const { user, accessToken, refreshToken } = result.data;


    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: 'None',
      maxAge: 24 * 60 * 60 * 1000 
    });

    return res.status(200).json({
      message: result.message,
      user,
      accessToken
    });

  } catch (err) {
    console.error('Login route error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;


