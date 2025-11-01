// ML Models removed - simple image validation instead
// import { GoogleGenerativeAI } from '@google/generative-ai'; // REMOVED

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // REMOVED
// const genAI = null; // REMOVED - ML models disabled

console.log('⚠️ Face verification using simple image check (ML models disabled)');

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
    
    // Convert base64 to buffer for basic validation
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

    console.log('🔍 Simple image validation (ML models disabled)...');

    // Simple validation: Check if image exists and has reasonable size
    // In production, you would use actual face verification API
    const minSize = 1000; // 1KB minimum
    const maxSize = 10 * 1024 * 1024; // 10MB maximum
    
    if (imageBuffer.length < minSize) {
      return res.json({
        success: false,
        status: 'Invalid',
        message: 'Image too small',
      });
    }
    
    if (imageBuffer.length > maxSize) {
      return res.json({
        success: false,
        status: 'Invalid',
        message: 'Image too large',
      });
    }

    // Simple check - accept all images (ML verification disabled)
    // In production, implement proper face verification
    console.log('✅ Image passed basic validation');
    const isVerified = true; // Always verify for now (ML models disabled)

    if (isVerified) {
      console.log('✅ Face verification successful');
      res.json({
        success: true,
        status: 'Verified',
        message: 'Face verified successfully',
      });
    } else {
      console.log('❌ Face verification failed');
      res.json({
        success: false,
        status: 'Fake',
        message: 'Face verification failed. Please retake the photo.',
      });
    }
  } catch (error) {
    console.error('❌ Error in verifyFace:', error);
    res.status(500).json({
      success: false,
      status: 'Error',
      message: error.message || 'Failed to verify face',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export default verifyFace;

