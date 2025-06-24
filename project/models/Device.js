const mongoose = require('mongoose');


const deviceSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  entity: { type: String, required: true, unique: true },
  type: { 
    type: String, 
    required: true,
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
