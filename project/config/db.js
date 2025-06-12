const mongoose = require('mongoose');

async function connectToMongoDB() {
  try {
    const conn = await mongoose.connect(
      'mongodb+srv://apoxmn:3Y%40QPVHKtFqp9e6@cluster0.qizgffq.mongodb.net/test?retryWrites=true&w=majority',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log('✅ MongoDB connected');

    try {
      const result = await mongoose.connection.db.collection('devices').dropIndex('deviceId_1');
      console.log('🗑️ Dropped index "deviceId_1":', result);
    } catch (dropErr) {
      if (dropErr.codeName === 'IndexNotFound') {
        console.log('ℹ️ Index "deviceId_1" not found, nothing to drop.');
      } else {
        console.error('❌ Failed to drop index:', dropErr.message);
      }
    }

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

module.exports = { connectToMongoDB };
