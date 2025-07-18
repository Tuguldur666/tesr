const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: String,
  phoneNumber: {
    type: Number,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
  type: Boolean,
  default: false
},
  isAdmin:{
  type: Boolean,
  default: false
}
});


UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});


UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


UserSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, phoneNumber : this.phoneNumber, isAdmin : this.isAdmin},
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '1d' }
  );
 
};

UserSchema.methods.generateReshreshToken = function () {
  console.log(process.env.REFRESH_TOKEN_SECRET)
  return jwt.sign(
    { id: this._id ,phoneNumber : this.phoneNumber, isAdmin : this.isAdmin},
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

};



module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
