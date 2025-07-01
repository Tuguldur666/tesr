const mongoose = require('mongoose');

const automationLogSchema = new mongoose.Schema({
  ruleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'Automation' 
  },
  action: { 
    type: String, 
    required: true,
    enum: ['ON', 'OFF'] 
  },
  timestamp: { 
    type: Date, 
    required: true, 
    default: Date.now,
    index: true 
  }
});

automationLogSchema.index({ 
  ruleId: 1, 
  action: 1, 
  timestamp: -1 
}, { 
  name: 'prevent_duplicate_automation_logs' 
});

const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);

AutomationLog.createIndexes()
  .then(() => console.log('AutomationLog indexes created'))
  .catch(err => console.error('Error creating AutomationLog indexes:', err));

module.exports = AutomationLog;