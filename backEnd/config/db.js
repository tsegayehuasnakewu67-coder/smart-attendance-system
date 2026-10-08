const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI (or legacy MONGO_URI) is required in backEnd/.env.');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB_NAME || 'SmartAttendanceDB',
    });
    console.log('MongoDB Connected Successfully');
    return conn;
  } catch {
    console.error('MongoDB connection failed. Verify the URI, database credentials, and network access settings.');
    throw new Error('MongoDB connection failed.');
  }
};

module.exports = connectDB;
