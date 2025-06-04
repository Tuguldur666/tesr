const mongoose = require('mongoose');

async function connectToMongoDB() {
  try {
    const conn = await mongoose.connect('mongodb+srv://apoxmn:3Y%40QPVHKtFqp9e6@cluster0.qizgffq.mongodb.net/test?retryWrites=true&w=majority', {
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

module.exports = { connectToMongoDB };
