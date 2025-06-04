const User = require('../models/user');
require('dotenv').config();


async function registerUser({ name, email, password }) {
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return { success: false, message: 'User already exists' };
    }

    const newUser = new User({
      id: Date.now(), 
      name,
      email,
      password
    });

    await newUser.save();

    const accessToken = newUser.generateAccessToken();
    const refreshToken = newUser.generateRefreshToken();

    return {
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email
        },
        accessToken,
        refreshToken
      }
    };
  } catch (err) {
    console.error(process.env.ACCESS_TOKEN_SECRET)
    console.error(process.env.REFRESH_TOKEN_SECRET)
    console.error('Error in registerUser:', err);
    return { success: false, message: 'Registration failed due to server error' };
  }
}

async function loginUser({ email, password }) {
  try {
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      return { success: false, message: 'Invalid email or password' };
    }

    const isMatch = await existingUser.comparePassword(password);

    if (!isMatch) {
      return { success: false, message: 'Invalid email or password' };
    }

    const accessToken =existingUser.generateAccessToken();
    const refreshToken = existingUser.generateReshreshToken();

    
    return {
      success: true,
      message: 'Successful login',
      data: {
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
        },
        accessToken,
        refreshToken,
      }
    };

  } catch (err) {
    console.error('Error in login:', err);
    return { success: false, message: 'Login failed' };
  }
}



module.exports = { registerUser , loginUser };
