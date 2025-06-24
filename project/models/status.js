const mongoose = require('mongoose');


const deviceStatusSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  entity: { type: String, required: true, unique: true },
  power: { type: String, enum: ['on', 'off', 'unknown'], default: 'unknown' },
  status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
  message: { type: String },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DeviceStatusLog', deviceStatusSchema);
