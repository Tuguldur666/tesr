const mongoose = require('mongoose');

const powerLogSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  power: { type: String, enum: ['on', 'off'], required: true },
  source: { type: String, required: true }, 
  topic: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PowerLog', powerLogSchema);
