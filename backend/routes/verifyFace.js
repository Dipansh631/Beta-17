import { getMongoDB } from '../config/mongodb.js';
import { ObjectId } from 'mongodb';

/**
 * Upload face/profile photo to MongoDB
 * No AI verification - just saves the photo after user confirmation
 */
const verifyFace = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image provided',
      });
    }

    // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    
    // Convert base64 to buffer
    let imageBuffer;
    try {
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      return res.status(400).json({
        success: false,
        status: 'Invalid',
        message: 'Invalid image data',
      });
    }

    // Validate image size (file size in bytes)
    const minSize = 100; // 100 bytes minimum (very small images might be corrupted)
    const maxSize = 10 * 1024 * 1024; // 10MB maximum
    
    console.log('📏 Image size validation:', {
      bufferSize: imageBuffer.length,
      minSize,
      maxSize,
      isValid: imageBuffer.length >= minSize && imageBuffer.length <= maxSize,
    });
    
    if (imageBuffer.length < minSize) {
      console.warn('⚠️ Image too small:', imageBuffer.length, 'bytes');
      return res.json({
        success: false,
        status: 'Invalid',
        message: `Image too small (${imageBuffer.length} bytes). Please capture a clear photo.`,
      });
    }
    
    if (imageBuffer.length > maxSize) {
      console.warn('⚠️ Image too large:', imageBuffer.length, 'bytes');
      return res.json({
        success: false,
        status: 'Invalid',
        message: 'Image too large (max 10MB). Please use a smaller image.',
      });
    }

    // Upload face/profile photo to MongoDB
    console.log('📤 Uploading profile photo to MongoDB...');
    let faceImageUrl = '';
    let faceFileId = null;

    try {
      const mongoDB = getMongoDB();
      if (!mongoDB || !mongoDB.gridFSBucket) {
        throw new Error('MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.');
      }

      const { gridFSBucket } = mongoDB;
      const fileId = new ObjectId();
      const fileName = `profile-${fileId}-${Date.now()}.jpg`;

      const uploadStream = gridFSBucket.openUploadStream(fileName, {
        _id: fileId,
        contentType: 'image/jpeg',
        metadata: {
          type: 'profile_photo',
          uploadedAt: new Date(),
        },
      });

      uploadStream.end(imageBuffer);

      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });

      faceFileId = fileId.toString();
      faceImageUrl = `/api/file/${faceFileId}`;
      
      console.log('✅ Profile photo uploaded to MongoDB:', faceFileId);
    } catch (mongoError) {
      console.error('❌ Error uploading profile photo to MongoDB:', mongoError);
      throw new Error(`Failed to upload profile photo: ${mongoError.message}`);
    }

    // Return success - no AI verification needed
    console.log('✅ Profile photo saved successfully');
    res.json({
      success: true,
      status: 'Saved',
      message: 'Profile photo saved successfully',
      faceImageUrl,
      faceFileId,
    });
  } catch (error) {
    console.error('❌ Error in verifyFace:', error);
    res.status(500).json({
      success: false,
      status: 'Error',
      message: error.message || 'Failed to save profile photo',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export default verifyFace;
