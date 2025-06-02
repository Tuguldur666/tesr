const User = require('../models/user');

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
      password, 
    });

    await newUser.save();

    return { success: true, user: newUser };
  } catch (err) {
    console.error('Error in registerUser:', err);
    return { success: false, message: 'ailed' };
  }
}

module.exports = { registerUser };
