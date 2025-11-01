import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import extractIdRoute from './routes/extractId.js';
import verifyFaceRoute from './routes/verifyFace.js';
import registerNgoRoute from './routes/registerNgo.js';
import uploadFile, { upload, getFile } from './routes/uploadFile.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'), false);
    }
  },
});

// MongoDB Connection
let mongoConnected = false;
connectMongoDB()
  .then(() => {
    mongoConnected = true;
    console.log('✅ MongoDB ready for file storage');
  })
  .catch((error) => {
    console.error('⚠️ MongoDB connection failed:', error.message);
    console.error('   File upload features will be disabled');
    console.error('   Set MONGODB_URI in .env to enable MongoDB storage');
  });

// Routes
// File upload to MongoDB
app.post('/api/upload-file', upload.single('file'), uploadFile);
app.get('/api/file/:fileId', getFile);

// Extract ID (accepts fileUrl - can be MongoDB URL or external URL)
app.use('/api/extract-id', extractIdRoute);
app.use('/api/verify-face', verifyFaceRoute);
app.use('/api/register-ngo', registerNgoRoute);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'NGO Registration API is running' });
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
  console.log(`🔐 Make sure to set PDFCO_API_KEY and GEMINI_API_KEY in .env`);
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

