const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  topics: {
    sensor: String,
    status: String,
    statusCommand: String,
  },
  registeredAt: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed }, 
});

module.exports = mongoose.model('Device', DeviceSchema);
