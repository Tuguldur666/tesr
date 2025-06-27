const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  authType: { type: String, enum: ['verify', 'reset'], required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } 
});

module.exports = mongoose.model('Otp', otpSchema);
