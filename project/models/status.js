const mongoose = require('mongoose');


const DeviceStatusLogSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  power: String,
  status: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});


module.exports = mongoose.model('DeviceStatusLog', DeviceStatusLogSchema);
