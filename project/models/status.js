const mongoose = require('mongoose');

const DeviceStatusLogSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true }, 
  status: { 
    type: String, 
    enum: ['on', 'off', 'disconnected', 'connected', 'error', 'offline'], 
    required: true 
  },
  message: { type: String },
  timestamp: { type: Date, default: Date.now },
});


module.exports = mongoose.model('DeviceStatusLog', DeviceStatusLogSchema);
