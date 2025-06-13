const mongoose = require('mongoose');

const DeviceStatusLogSchema = new mongoose.Schema({
  clientId: { type: String, required: true }, 
  
  power: { 
    type: String, 
    enum: ['on', 'off', 'disconnected', 'connected'], 
    required: true 
  },
  
  status: { 
    type: String, 
    enum: ['online', 'offline', 'error'], 
    required: true 
  },

  message: { type: String },

  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DeviceStatusLog', DeviceStatusLogSchema);
