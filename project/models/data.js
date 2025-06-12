const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  entity: { type: String, required: true },
  data: { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now},
});

const SensorData = mongoose.model('SensorData', sensorDataSchema, 'datas');


module.exports = SensorData;
