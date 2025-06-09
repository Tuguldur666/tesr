const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },

  data: { type: Object, default: {} }, 

});

const SensorData = mongoose.model('SensorData', sensorDataSchema);

module.exports = SensorData;
