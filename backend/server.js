import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import extractIdRoute from './routes/extractId.js';
import verifyFaceRoute from './routes/verifyFace.js';
import registerNgoRoute from './routes/registerNgo.js';
import uploadFile, { upload, getFile } from './routes/uploadFile.js';
import { verifyImageWithGemini } from './routes/verifyImage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Configure Helmet to allow images from same origin and allow inline images
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:3000", "http://localhost:8080", "http://localhost:8081", "http://localhost:8082"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:8081', 'http://localhost:8082'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Content-Disposition'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection with retry
let mongoConnected = false;

async function initializeMongoDB() {
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 MongoDB connection attempt ${attempt}/${maxRetries}...`);
      await connectMongoDB();
      mongoConnected = true;
      console.log('✅ MongoDB ready for file storage');
      return true;
    } catch (error) {
      console.error(`⚠️ MongoDB connection attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        console.log(`   Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('❌ MongoDB connection failed after all retries');
        console.error('   File upload features will be disabled');
        console.error('   Fix: Check MongoDB connection string and Atlas IP whitelist');
        mongoConnected = false;
        return false;
      }
    }
  }
  return false;
}

// Initialize MongoDB (don't block server start)
initializeMongoDB();

// Routes
// File upload to MongoDB (uses multer from uploadFile.js)
app.post('/api/upload-file', upload.single('file'), uploadFile);
// Add OPTIONS handler for CORS preflight on file endpoint
app.options('/api/file/:fileId', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});
app.get('/api/file/:fileId', getFile);

// Extract ID (accepts fileUrl - can be MongoDB URL or external URL)
app.post('/api/extract-id', extractIdRoute);
app.post('/api/verify-face', verifyFaceRoute);
app.post('/api/register-ngo', registerNgoRoute);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'NGO Registration API is running',
    mongodb: mongoConnected ? 'connected' : 'disconnected'
  });
});

// MongoDB reconnect endpoint (for manual reconnection)
app.post('/api/reconnect-mongodb', async (req, res) => {
  try {
    const result = await initializeMongoDB();
    if (result) {
      res.json({ success: true, message: 'MongoDB reconnected successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to reconnect MongoDB' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Debug endpoint to check GridFS
app.get('/api/debug/gridfs', async (req, res) => {
  try {
    const { getMongoDB } = await import('./config/mongodb.js');
    const mongoDB = getMongoDB();
    
    if (!mongoDB || !mongoDB.gridFSBucket) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB not connected',
      });
    }
    
    const { gridFSBucket } = mongoDB;
    const recentFiles = await gridFSBucket.find().sort({ uploadDate: -1 }).limit(10).toArray();
    
    res.json({
      success: true,
      totalFiles: recentFiles.length,
      files: recentFiles.map(f => ({
        id: f._id.toString(),
        filename: f.filename,
        length: f.length,
        contentType: f.contentType,
        uploadDate: f.uploadDate,
        metadata: f.metadata,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  console.error('Error Stack:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Make sure to set GEMINI_API_KEY in .env`);
  console.log(`📦 MongoDB: ${mongoConnected ? 'Connected' : 'Not connected (set MONGODB_URI in .env)'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  await disconnectMongoDB();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await disconnectMongoDB();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`   Please stop the process using port ${PORT} or change PORT in .env`);
    console.error(`   To kill process on port ${PORT}, run:`);
    console.error(`   Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

