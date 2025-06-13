const mongoose = require('mongoose');

const allowedCategories = ['temperature', 'motion', 'light', 'humidity', 'generic','bridge'];

const deviceSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  entity: { type: String, required: true, unique: true },
  category: { 
    type: String, 
    required: true, 
    enum: allowedCategories,
  },
  type: { 
    type: String, 
    required: true,
  },
  topics: {
    sensor: String,
    status: String,
    statusCommand: String,
  },
  registeredAt: { type: Date, default: Date.now },
  metadata: { type: Object, default: {} },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
