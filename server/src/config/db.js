import dns from 'dns';
import mongoose from 'mongoose';

// Use public DNS resolvers for SRV lookups if local DNS returns ECONNREFUSED.
// This fixes Node.js SRV resolution failures for MongoDB Atlas in restricted environments.
dns.setServers(['8.8.8.8', '1.1.1.1']);

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Fail fast if connection not ready
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    // Log connection attempt
    console.log('Attempting MongoDB connection with URI:', process.env.MONGO_URI ? 'URI exists' : 'URI MISSING');
    
    cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      return mongoose;
    }).catch((err) => {
      console.error('MongoDB Connection Failed:', err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error(`MongoDB Connection Error: ${e.message}`);
    throw e; // Ensure the error propagates so the app knows connection failed
  }
  return cached.conn;
};

export default connectDB;