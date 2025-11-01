import multer from 'multer';
import { ObjectId } from 'mongodb';
import { getMongoDB } from '../config/mongodb.js';
import fs from 'fs';
import path from 'path';

// Configure multer for in-memory storage (for MongoDB GridFS)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'), false);
    }
  },
});

/**
 * Upload file to MongoDB GridFS
 * POST /api/upload-file
 * Content-Type: multipart/form-data
 * Body: { file: File }
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { gridFSBucket } = getMongoDB();

    const fileId = new ObjectId();
    const fileName = `${fileId}-${req.file.originalname}`;

    console.log('📤 Uploading file to MongoDB GridFS...');
    console.log('   File ID:', fileId);
    console.log('   File Name:', req.file.originalname);
    console.log('   File Size:', req.file.size, 'bytes');
    console.log('   File Type:', req.file.mimetype);

    // Upload to GridFS
    const uploadStream = gridFSBucket.openUploadStream(fileName, {
      _id: fileId,
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        uploadedBy: req.body.userId || 'anonymous',
        uploadedAt: new Date(),
      },
    });

    // Write file buffer to GridFS
    uploadStream.end(req.file.buffer);

    // Wait for upload to complete
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    console.log('✅ File uploaded to MongoDB GridFS successfully');

    // Return file ID and download URL
    const fileUrl = `/api/file/${fileId}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

    res.json({
      success: true,
      data: {
        fileId: fileId.toString(),
        fileName: req.file.originalname,
        fileUrl: fullUrl,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
      },
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('❌ Error uploading file to MongoDB:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Get file from MongoDB GridFS
 * GET /api/file/:fileId
 */
export const getFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { gridFSBucket } = getMongoDB();

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID',
      });
    }

    const objectId = new ObjectId(fileId);

    // Find file metadata
    const files = await gridFSBucket.find({ _id: objectId }).toArray();
    
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const file = files[0];

    // Set appropriate headers
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.metadata?.originalName || 'file'}"`);

    // Stream file from GridFS
    const downloadStream = gridFSBucket.openDownloadStream(objectId);

    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('❌ Error downloading file from MongoDB:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to download file',
        });
      }
    });
  } catch (error) {
    console.error('❌ Error getting file from MongoDB:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get file',
    });
  }
};

export { upload };
export default uploadFile;


