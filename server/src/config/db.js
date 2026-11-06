import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(customUri) {
  const uri = customUri || (env.NODE_ENV === 'test' && env.MONGODB_URI_TEST ? env.MONGODB_URI_TEST : env.MONGODB_URI);

  try {
    const conn = await mongoose.connect(uri);
    if (env.NODE_ENV !== 'test') {
      console.log(`MongoDB connected: ${conn.connection.host}`);
    }
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    if (env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
