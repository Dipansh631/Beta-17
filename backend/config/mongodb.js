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
    console.log('   URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
    
    // MongoDB connection options for better compatibility
    // Only enable TLS for Atlas connections (mongodb+srv://)
    const isAtlasConnection = MONGODB_URI.startsWith('mongodb+srv://');
    const clientOptions = {
      serverSelectionTimeoutMS: 15000, // 15 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      connectTimeoutMS: 15000, // 15 seconds connection timeout
      ...(isAtlasConnection && {
        tls: true, // Enable TLS/SSL for Atlas
        tlsAllowInvalidCertificates: false,
      }),
    };

    client = new MongoClient(MONGODB_URI, clientOptions);

    await client.connect();
    db = client.db(DB_NAME);
    
    // Initialize GridFS bucket for file storage
    gridFSBucket = new GridFSBucket(db, { bucketName: 'ngo_files' });

    console.log('✅ MongoDB connected successfully');
    console.log(`📦 Database: ${DB_NAME}`);
    console.log(`📁 GridFS Bucket: ngo_files`);

    return { client, db, gridFSBucket };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('   Make sure:');
    console.error('   1. MongoDB Atlas IP whitelist includes your IP (or 0.0.0.0/0 for testing)');
    console.error('   2. Username and password are correct');
    console.error('   3. Connection string is valid');
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
 * Returns null if not connected (instead of throwing)
 */
export const getMongoDB = () => {
  if (!db || !gridFSBucket) {
    return null;
  }
  return { client, db, gridFSBucket };
};

/**
 * Check if MongoDB is connected
 */
export const isMongoDBConnected = () => {
  return db !== null && gridFSBucket !== null;
};

export default { connectMongoDB, disconnectMongoDB, getMongoDB, isMongoDBConnected };

