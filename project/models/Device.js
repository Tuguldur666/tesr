const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  entity: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  owner: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }
  ],
  // Status-related fields:
  power: { type: String, enum: ['ON', 'OFF', 'unknown'], default: 'unknown' },
  status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
  lastSeen: { type: Date },
});


const Device = mongoose.model('Device', deviceSchema);

module.exports = Device