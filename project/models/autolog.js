const mongoose = require('mongoose');

const automationLogSchema = new mongoose.Schema({
  ruleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'Automation' // Add reference if ruleId refers to Automation model
  },
  action: { 
    type: String, 
    required: true,
    enum: ['ON', 'OFF'] // Ensures only these values are allowed
  },
  timestamp: { 
    type: Date, 
    required: true, 
    default: Date.now,
    index: true // Individual index on timestamp
  }
});

// Compound index for duplicate prevention
automationLogSchema.index({ 
  ruleId: 1, 
  action: 1, 
  timestamp: -1 
}, { 
  name: 'prevent_duplicate_automation_logs' 
});

// Create the model
const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);

// Ensure indexes after model creation (optional - mongoose usually handles this)
AutomationLog.createIndexes()
  .then(() => console.log('AutomationLog indexes created'))
  .catch(err => console.error('Error creating AutomationLog indexes:', err));

module.exports = AutomationLog;