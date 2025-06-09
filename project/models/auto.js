const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  topic: { type: String, required: true },
  onTime: { type: String, required: true },  // format: 'HH:mm'
  offTime: { type: String, required: true }, // format: 'HH:mm'
  timezone: { type: String, default: 'America/New_York' }, // ET time
  enabled: { type: Boolean, default: true },
});

module.exports = mongoose.model('Automation', automationSchema);
