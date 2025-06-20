const mongoose = require('mongoose');

const powerLogSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  power: { type: String, required: true },
  source: { type: String, required: true },
  topic: { type: String, required: true },
  timestamp: { type: Date, required: true },
});

powerLogSchema.index(
  { clientId: 1, power: 1, source: 1, topic: 1, timestamp: 1 },
  { unique: true }
);

module.exports = mongoose.model('powerlogs', powerLogSchema);
