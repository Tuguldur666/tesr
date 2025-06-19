// models/AutomationLog.js

const mongoose = require('mongoose');

const automationLogSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation', required: true },
  topic: { type: String, required: true },
  action: { type: String, enum: ['ON', 'OFF'], required: true },
  executedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AutomationLog', automationLogSchema);
