const mongoose = require('mongoose');

async function connectToMongoDB() {
  try {
    const conn = await mongoose.connect('mongodb://admin:1234@localhost:27017/test?authSource=admin', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

module.exports = {connectToMongoDB};
