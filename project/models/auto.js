const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  onTime: { type: String, required: true },  
  offTime: { type: String, required: true }, 
  timezone: { type: String, default: 'Asia/Mongolia' }, 
  enabled: { type: Boolean, default: true },
});


module.exports = mongoose.model('Automation', automationSchema);
