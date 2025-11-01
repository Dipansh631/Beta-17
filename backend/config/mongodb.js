import { MongoClient, GridFSBucket } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB connection string - can be local or Atlas
// Format: mongodb://localhost:27017 (local) or mongodb+srv://user:pass@cluster.mongodb.net/ (Atlas)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'community_donation_tracker';

let client = null;
let db = null;
let gridFSBucket = null;

/**
 * Connect to MongoDB
 */
export const connectMongoDB = async () => {
  try {
    if (client) {
      console.log('✅ MongoDB already connected');
      return { client, db, gridFSBucket };
    }

    console.log('🔄 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);

    await client.connect();
    db = client.db(DB_NAME);
    
    // Initialize GridFS bucket for file storage
    gridFSBucket = new GridFSBucket(db, { bucketName: 'ngo_files' });

    console.log('✅ MongoDB connected successfully');
    console.log(`📦 Database: ${DB_NAME}`);
    console.log(`📁 GridFS Bucket: ngo_files`);

    return { client, db, gridFSBucket };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectMongoDB = async () => {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      gridFSBucket = null;
      console.log('✅ MongoDB disconnected');
    }
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error);
  }
};

/**
 * Get MongoDB instance
 */
export const getMongoDB = () => {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectMongoDB() first.');
  }
  return { client, db, gridFSBucket };
};

export default { connectMongoDB, disconnectMongoDB, getMongoDB };

