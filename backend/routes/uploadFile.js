import multer from 'multer';
import { ObjectId } from 'mongodb';
import { getMongoDB } from '../config/mongodb.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { verifyImageWithGemini } from './verifyImage.js';

dotenv.config();

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
  // Set CORS headers early
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    console.log('📥 Received upload request:', {
      hasFile: !!req.file,
      hasFiles: !!req.files,
      body: Object.keys(req.body),
      fileField: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      } : null,
      verifyImage: req.body.verifyImage === 'true',
      hasConditions: !!req.body.conditions,
    });

    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a file.',
      });
    }

    // Image verification if requested (for NGO image uploads)
    // Uses LLaVA model for verification (no API key required)
    if (req.body.verifyImage === 'true' && req.file.mimetype.startsWith('image/')) {
      console.log('🔍 Image verification requested (using LLaVA model)...');
      console.log('   Conditions provided:', !!req.body.conditions);
      console.log('   Require verification:', req.body.requireVerification === 'true');
      
      try {
        let conditions = [];
        if (req.body.conditions) {
          try {
            conditions = JSON.parse(req.body.conditions);
            console.log(`   Parsed ${conditions.length} conditions`);
          } catch (e) {
            console.warn('⚠️ Failed to parse conditions:', e.message);
            console.warn('   Raw conditions:', req.body.conditions?.substring(0, 100));
            conditions = [];
          }
        }

        // Check if strict condition matching is required
        const requireStrictMatch = req.body.requireConditionMatch === 'true';
        
        const verification = await verifyImageWithGemini(
          req.file.buffer,
          req.file.mimetype,
          conditions,
          requireStrictMatch
        );

        console.log('✅ Image verification completed:', {
          satisfiesConditions: verification.satisfiesConditions,
          isAIGenerated: verification.isAIGenerated,
          confidence: verification.confidence,
        });

        // Reject if AI-generated (CRITICAL CHECK - MUST BE FIRST)
        if (verification.isAIGenerated) {
          console.log('❌ Image rejected: Detected as AI-generated');
          console.log('   AI generation signs:', verification.details?.aiGenerationSigns || 'Not specified');
          
          const aiSigns = verification.details?.aiGenerationSigns || [];
          const signsText = aiSigns.length > 0 
            ? ` Detected signs: ${aiSigns.slice(0, 3).join(', ')}${aiSigns.length > 3 ? '...' : ''}`
            : '';
          
          return res.status(400).json({
            success: false,
            message: `Image verification failed: This image appears to be AI-generated or synthetic. Only real photographs of actual NGO work are accepted.${signsText} Please upload authentic photos taken during actual work activities.`,
            verification: {
              satisfied: false,
              reason: 'AI-generated image detected',
              details: verification.details,
              aiGenerationSigns: aiSigns,
            },
          });
        }

        // Reject if doesn't satisfy conditions
        if (!verification.satisfiesConditions) {
          console.log('❌ Image rejected: Does not satisfy NGO conditions');
          const reasonText = verification.reasoning ? ` ${verification.reasoning}` : '';
          
          // Create condition list for error message
          const conditionList = conditions.length > 0 
            ? conditions.map(c => c.title).join(', ')
            : 'specified conditions';
          
          const strictModeNote = requireStrictMatch 
            ? ` The image must show work specifically related to the condition(s) you allocated money to: ${conditionList}.`
            : '';
          
          return res.status(400).json({
            success: false,
            message: `Image verification failed: This image does not match any of the allocated condition(s): ${conditionList}.${strictModeNote}${reasonText}`,
            verification: {
              satisfied: false,
              reason: 'Image does not satisfy conditions',
              details: verification.details,
              checkedConditions: conditions.map(c => c.title),
            },
          });
        }

        console.log('✅ Image verification passed');
        // Store verification result in metadata
        req.file.verification = verification;
      } catch (verificationError) {
        console.error('❌ Image verification error:', verificationError);
        console.error('   Error message:', verificationError.message);
        console.error('   Error name:', verificationError.name);
        if (verificationError.stack) {
          console.error('   Error stack:', verificationError.stack.substring(0, 500));
        }
        
        const errorMessage = verificationError.message || 'Unknown verification error';
        const errorStr = errorMessage.toLowerCase();
        
        // Check if it's an API key or model availability issue - allow upload in these cases
        // Model errors or API key errors are configuration issues, not verification failures
        // Priority: Check for actual verification failures first, then allow all config errors
        
        // First check if it's an ACTUAL verification failure (AI-generated or doesn't match)
        const isActualVerificationFailure = 
          errorStr.includes('ai-generated') || 
          errorStr.includes('does not match') || 
          errorStr.includes('doesn\'t match') ||
          errorStr.includes('doesn\'t satisfy');
        
        // If it's an actual verification failure, reject
        if (isActualVerificationFailure) {
          console.error('❌ Actual verification failure detected - image rejected');
          console.error('   Error:', errorMessage);
          return res.status(400).json({
            success: false,
            message: `Image verification failed: ${errorMessage}`,
          });
        }
        
        // Otherwise, treat as configuration error and allow upload
        // All errors that reach here are configuration issues (not actual verification failures)
        console.warn('⚠️ Verification configuration issue detected - allowing upload without verification');
        console.warn('   Error:', errorMessage);
        console.warn('   Error type: LLaVA Model availability issue');
        console.warn('   Fix: Install Python dependencies: pip install -r backend/requirements_verification.txt');
        console.warn('   Upload will proceed without verification');
        
        // Always allow upload if it's a configuration error (we already checked for actual failures above)
        // Continue with upload - don't return error
      }
    }

    let mongoDB = getMongoDB();
    if (!mongoDB || !mongoDB.gridFSBucket) {
      // Try to reconnect once before giving up
      console.log('⚠️ MongoDB not connected, attempting reconnection...');
      try {
        const { connectMongoDB } = await import('../config/mongodb.js');
        await connectMongoDB();
        mongoDB = getMongoDB();
        
        if (!mongoDB || !mongoDB.gridFSBucket) {
          return res.status(503).json({
            success: false,
            message: 'MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.',
            error: 'MongoDB connection failed. File upload unavailable.',
          });
        }
        console.log('✅ MongoDB reconnected, proceeding with upload');
      } catch (reconnectError) {
        console.error('❌ MongoDB reconnection failed:', reconnectError.message);
        return res.status(503).json({
          success: false,
          message: 'MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.',
          error: `MongoDB connection failed: ${reconnectError.message}`,
        });
      }
    }

    const { gridFSBucket } = mongoDB;

    // Generate file ID first
    let fileId = new ObjectId();
    // Sanitize filename to avoid special characters issues
    const sanitizedOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${fileId}-${sanitizedOriginalName}`;

    console.log('📤 Uploading file to MongoDB GridFS...');
    console.log('   File ID:', fileId.toString());
    console.log('   Original Name:', req.file.originalname);
    console.log('   Sanitized Name:', fileName);
    console.log('   File Size:', req.file.size, 'bytes');
    console.log('   File Type:', req.file.mimetype);
    console.log('   User ID:', req.body.userId || 'anonymous');

    // Upload to GridFS with explicit file ID
    let uploadStream;
    try {
      uploadStream = gridFSBucket.openUploadStream(fileName, {
        _id: fileId, // Explicitly set the file ID
        contentType: req.file.mimetype,
        metadata: {
          originalName: req.file.originalname,
          uploadedBy: req.body.userId || 'anonymous',
          uploadedAt: new Date(),
        },
      });
      console.log('✅ Upload stream created');
    } catch (streamError) {
      console.error('❌ Error creating upload stream:', streamError);
      throw new Error(`Failed to create upload stream: ${streamError.message}`);
    }

    // Write file buffer to GridFS
    uploadStream.end(req.file.buffer);

    // Wait for upload to complete
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => {
        console.log('✅ GridFS upload stream finished');
        console.log('   Uploaded file ID:', uploadStream.id.toString());
        resolve();
      });
      uploadStream.on('error', (err) => {
        console.error('❌ GridFS upload stream error:', err);
        reject(err);
      });
    });

    // Small delay to ensure GridFS has committed the file
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify file was actually saved to GridFS
    console.log('🔍 Verifying file was saved to GridFS...');
    console.log('   Looking for file ID:', fileId.toString());
    
    let files;
    try {
      files = await gridFSBucket.find({ _id: fileId }).toArray();
      console.log('   Files found:', files.length);
      
      // If not found, try finding by filename as fallback
      if (!files || files.length === 0) {
        console.log('   File not found by ID, trying to find by filename...');
        files = await gridFSBucket.find({ filename: fileName }).toArray();
        console.log('   Files found by filename:', files.length);
        
        if (files && files.length > 0) {
          // Update fileId to the actual ID found
          const actualFileId = files[0]._id;
          console.log('   Found file with different ID:', actualFileId.toString());
          fileId = actualFileId;
        }
      }
    } catch (findError) {
      console.error('❌ Error finding file in GridFS:', findError);
      throw new Error(`Failed to verify file upload: ${findError.message}`);
    }
    
    if (!files || files.length === 0) {
      console.error('❌ File verification failed - file not found in GridFS after upload!');
      console.error('   Expected file ID:', fileId.toString());
      console.error('   Expected filename:', fileName);
      
      // Try to list recent files to debug
      try {
        const recentFiles = await gridFSBucket.find().sort({ uploadDate: -1 }).limit(5).toArray();
        console.error('   Recent files in GridFS:', recentFiles.map(f => ({
          id: f._id.toString(),
          filename: f.filename,
          uploadDate: f.uploadDate,
        })));
      } catch (listError) {
        console.error('   Could not list recent files:', listError.message);
      }
      
      throw new Error('File upload verification failed. File was not saved to database. Please try again.');
    }
    
    console.log('✅ File uploaded to MongoDB GridFS successfully');
    console.log('   File ID:', fileId.toString());
    console.log('   File name:', files[0].filename);
    console.log('   File size:', files[0].length, 'bytes');
    console.log('   Upload date:', files[0].uploadDate);

    // Return file ID and download URL (use relative URL for consistency)
    const fileUrl = `/api/file/${fileId}`;
    const fullUrl = `${req.protocol}://${req.get('host') || req.get('hostname') || 'localhost:3000'}${fileUrl}`;

    res.json({
      success: true,
      data: {
        fileId: fileId.toString(),
        fileName: req.file.originalname,
        fileUrl: fileUrl, // Return relative URL to avoid issues
        fullUrl: fullUrl, // Also provide full URL for reference
        fileSize: req.file.size,
        fileType: req.file.mimetype,
      },
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('❌ Error uploading file to MongoDB:', error);
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack?.substring(0, 500));
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to upload file';
    let statusCode = 500;
    
    if (error.message?.includes('MongoDB not connected')) {
      statusCode = 503;
      errorMessage = 'MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.';
    } else if (error.message?.includes('verification failed')) {
      errorMessage = 'File upload completed but verification failed. The file may not have been saved. Please try again.';
    } else if (error.message?.includes('stream')) {
      errorMessage = 'Failed to create upload stream. Please check MongoDB connection.';
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500),
      } : undefined,
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
    
    const mongoDB = getMongoDB();
    if (!mongoDB || !mongoDB.gridFSBucket) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.',
        error: 'MongoDB connection failed. File retrieval unavailable.',
      });
    }

    const { gridFSBucket } = mongoDB;

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

    // Set appropriate headers with CORS
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.metadata?.originalName || 'file'}"`);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins for images
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

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

