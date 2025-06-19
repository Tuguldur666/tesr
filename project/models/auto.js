const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  entity: { type: String, required: true },
  topic: { type: String, required: true },
  onTime: { type: String, required: true },  
  offTime: { type: String, required: true }, 
  timezone: { type: String, default: 'Asia/Mongolia' }, 
  enabled: { type: Boolean, default: true },
});

automationSchema.index({ clientId: 1, onTime: 1, offTime: 1 }, { unique: true });

module.exports = mongoose.model('Automation', automationSchema);
