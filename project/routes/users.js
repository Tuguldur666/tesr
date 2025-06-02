const express = require('express');
const router = express.Router();
const { registerUser } = require('../services/userService');


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
            name: " sdcklds",
            email: "GGGGG",
            password: "dcnsjkdc"
        }
    }
    */

  const { name, email, password } = req.body;

  const result = await registerUser({ name, email, password });

  if (result.success) {
    res.status(201).json(result.user);
  } else {
    res.status(400).json({ message: result.message });
  }
});

module.exports = router;


