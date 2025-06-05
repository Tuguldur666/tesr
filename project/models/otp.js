const mongoose = require('mongoose');

const AuthMsgSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  authType: {
    type: String,
    enum: ['verify', 'reset'],
    required: true
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 
  }
});

module.exports = mongoose.models.AuthMsg || mongoose.model('AuthMsg', AuthMsgSchema);
