const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  entity: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  owner: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  // Status-related fields:
  power: { type: String, enum: ['on', 'off', 'unknown'], default: 'unknown' },
  status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
  lastSeen: { type: Date },
});


const Device = mongoose.model('Device', deviceSchema);

module.exports = Device