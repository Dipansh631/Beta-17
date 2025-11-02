import { GoogleGenerativeAI } from '@google/generative-ai';
import { getMongoDB } from '../config/mongodb.js';
import { ObjectId } from 'mongodb';

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize Gemini AI
let genAI = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI initialized for ID extraction');
  } catch (error) {
    console.error('❌ Failed to initialize Gemini AI:', error.message);
  }
} else {
  console.warn('⚠️ GEMINI_API_KEY not set. ID extraction will be disabled.');
}

/**
 * Extract ID information from a file using Gemini Vision API
 * 
 * Flow:
 * 1. Receive file URL from MongoDB
 * 2. Download file from MongoDB GridFS
 * 3. Use Gemini Vision API to extract text and structure data directly
 * 4. Return structured data to frontend
 */
const extractId = async (req, res) => {
  try {
    // Validate request body
    const { fileUrl, fileName, fileType } = req.body;

    console.log('📥 Received extract-id request:', {
      fileUrl: fileUrl ? fileUrl.substring(0, 100) + (fileUrl.length > 100 ? '...' : '') : 'missing',
      fileName: fileName || 'N/A',
      fileType: fileType || 'N/A',
      bodyKeys: Object.keys(req.body),
    });

    if (!fileUrl) {
      console.error('❌ No fileUrl in request body');
      return res.status(400).json({
        success: false,
        message: 'No file URL provided. Please upload file first.',
      });
    }

    // Validate API key
    if (!GEMINI_API_KEY || !genAI) {
      console.error('❌ GEMINI_API_KEY not configured or Gemini AI not initialized');
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY not configured. Please set GEMINI_API_KEY in .env',
      });
    }

    // Validate file type
    const isImage = fileType && (fileType.startsWith('image/'));
    const isPDF = fileType === 'application/pdf';

    if (!isImage && !isPDF) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file type. Please upload JPG, PNG, or PDF.',
      });
    }

    console.log('📤 Starting ID extraction process...');
    console.log('📄 File URL:', fileUrl);
    console.log('📋 File Name:', fileName || 'N/A');
    console.log('📦 File Type:', fileType || 'N/A');

    // Step 1: Download file from MongoDB
    console.log('📥 Step 1: Downloading file from MongoDB...');
    let fileBuffer = null;
    let mimeType = fileType || 'image/jpeg';

    try {
      // Extract file ID from URL (handles both relative and full URLs)
      let fileId;
      if (fileUrl.startsWith('/api/file/')) {
        fileId = fileUrl.replace('/api/file/', '').split('?')[0]; // Remove query params if any
      } else {
        // Extract from full URL using regex
        const match = fileUrl.match(/\/api\/file\/([a-fA-F0-9]{24})/);
        if (!match) {
          throw new Error(`Invalid MongoDB file URL format: ${fileUrl}`);
        }
        fileId = match[1];
      }

      console.log('📋 Extracted file ID:', fileId);

      if (!ObjectId.isValid(fileId)) {
        throw new Error(`Invalid MongoDB file ID format: ${fileId}`);
      }

      const mongoDB = getMongoDB();
      if (!mongoDB || !mongoDB.gridFSBucket) {
        throw new Error('MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.');
      }

      const { gridFSBucket } = mongoDB;
      const objectId = new ObjectId(fileId);

      // First, verify file exists in GridFS
      console.log('🔍 Checking if file exists in GridFS...');
      const files = await gridFSBucket.find({ _id: objectId }).toArray();

      if (!files || files.length === 0) {
        console.error(`❌ File not found in GridFS. File ID: ${fileId}`);
        throw new Error(`File not found in database. File ID: ${fileId}. Please try uploading again.`);
      }

      console.log('✅ File found in GridFS:', {
        filename: files[0].filename,
        length: files[0].length,
        uploadDate: files[0].uploadDate,
      });

      // Download file from GridFS
      console.log('📥 Downloading file from GridFS...');
      const downloadStream = gridFSBucket.openDownloadStream(objectId);

      const chunks = [];
      fileBuffer = await new Promise((resolve, reject) => {
        downloadStream.on('data', (chunk) => chunks.push(chunk));
        downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
        downloadStream.on('error', (err) => {
          console.error('❌ GridFS download stream error:', err);
          reject(err);
        });
      });

      mimeType = files[0].contentType || fileType || 'image/jpeg';
      console.log('✅ File downloaded from MongoDB:', fileBuffer.length, 'bytes');
      console.log('   MIME type:', mimeType);
    } catch (downloadError) {
      console.error('❌ Error downloading file from MongoDB:', downloadError);
      throw new Error(`Failed to download file from MongoDB: ${downloadError.message}`);
    }

    // Step 2: Use Gemini Vision API to extract and structure ID data directly
    console.log('🤖 Step 2: Using Gemini Vision API to extract ID data...');

    try {
      // Convert buffer to base64
      const base64Data = fileBuffer.toString('base64');

      // Use Gemini model that supports vision
      // Newer models: gemini-2.5-flash, gemini-flash-latest, gemini-2.5-pro
      let model;
      let modelName;
      
      // Try models in order of preference (fastest first)
      const visionModels = [
        'gemini-2.5-flash',           // Latest flash model (fast, supports vision)
        'gemini-flash-latest',        // Stable latest flash
        'gemini-2.0-flash',           // Flash 2.0
        'gemini-2.5-pro',             // Pro model (better quality)
        'gemini-pro-latest',          // Latest pro
      ];
      
      for (const tryModel of visionModels) {
        try {
          model = genAI.getGenerativeModel({ model: tryModel });
          modelName = tryModel;
          console.log(`✅ Using model: ${modelName}`);
          break;
        } catch (e) {
          console.log(`   ${tryModel} not available, trying next...`);
        }
      }
      
      if (!model) {
        throw new Error('No vision-capable Gemini models available. Check your API key access.');
      }

      const prompt = `Analyze this Indian ID document (Aadhaar or PAN card) image/PDF and extract the following information.

Return ONLY valid JSON format with these exact keys (no markdown, no explanations):
{
  "name": "Full name as it appears on the document",
  "dob": "Date of birth in DD-MM-YYYY format",
  "gender": "Male, Female, or Transgender",
  "address": "Complete address as shown on document",
  "id_number": "ID number (Aadhaar number or PAN number)",
  "id_type": "Aadhaar" or "PAN"
}

Important instructions:
- Return ONLY the JSON object, no markdown code blocks, no explanations
- If any field cannot be found, use empty string ""
- For id_type, determine if it's "Aadhaar" or "PAN" based on the ID number format and document layout
- Date format must be DD-MM-YYYY
- Extract the complete address including street, city, state, pincode if available
- Name should be the full name as printed on the document
- ID number should be the complete number without spaces or hyphens`;

      console.log('   Sending image to Gemini Vision API...');

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
      ]);

      const response = await result.response;
      const geminiText = response.text();

      console.log('✅ Gemini Vision response received');
      console.log('   Response preview:', geminiText.substring(0, 200) + '...');

      // Parse JSON from Gemini response
      let structuredData;
      try {
        // Remove markdown code blocks if present
        let jsonText = geminiText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        // Extract JSON object if wrapped in other text
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }

        structuredData = JSON.parse(jsonText);
        console.log('✅ Step 2 Complete: Data structured successfully');
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini JSON:', parseError.message);
        console.error('   Raw Gemini response:', geminiText);
        throw new Error(`Failed to parse extracted data from Gemini: ${parseError.message}. Response: ${geminiText.substring(0, 100)}`);
      }

      // Validate and clean the structured data
      const cleanedData = {
        name: (structuredData.name || '').trim(),
        dob: (structuredData.dob || '').trim(),
        gender: (structuredData.gender || '').trim(),
        address: (structuredData.address || '').trim(),
        id_number: (structuredData.id_number || '').trim().replace(/\s/g, ''),
        id_type: (structuredData.id_type || '').trim(),
      };

      console.log('📋 Final extracted data:', cleanedData);

      // Return structured data
      return res.json({
        success: true,
        data: cleanedData,
        message: 'ID information extracted successfully',
      });
    } catch (geminiError) {
      console.error('❌ Gemini Vision API Error:', geminiError);
      console.error('   Error details:', {
        message: geminiError.message,
        stack: geminiError.stack?.substring(0, 500),
      });
      throw new Error(`Gemini AI failed: ${geminiError.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ Error in extractId route:', error);
    console.error('   Error Type:', error.constructor.name);
    console.error('   Error Message:', error.message);
    console.error('   Error Stack:', error.stack);

    // Log more details for debugging
    if (error.response) {
      console.error('   API Response Status:', error.response.status);
      console.error('   API Response Data:', JSON.stringify(error.response.data).substring(0, 500));
    }
    if (error.config) {
      console.error('   Request URL:', error.config.url);
      console.error('   Request Method:', error.config.method);
    }

    // Provide user-friendly error message
    let errorMessage = 'Failed to extract ID information';
    let statusCode = 500;
    let errorDetails = {};

    if (error.response) {
      // API error
      statusCode = error.response.status || 500;
      errorMessage = error.response.data?.message || error.response.data?.error || error.message;
      errorDetails = {
        apiError: true,
        apiStatus: error.response.status,
        apiResponse: error.response.data,
      };
    } else if (error.message) {
      errorMessage = error.message;
      if (error.message.includes('not configured')) {
        statusCode = 500;
      } else if (error.message.includes('No file URL')) {
        statusCode = 400;
      } else if (error.message.includes('Unsupported file type')) {
        statusCode = 400;
      } else if (error.message.includes('MongoDB not connected')) {
        statusCode = 503;
        errorMessage = 'MongoDB not connected. Please check backend connection.';
      } else if (error.message.includes('Failed to download file')) {
        statusCode = 500;
        errorMessage = 'Failed to retrieve file from database. Please try uploading again.';
      }
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.substring(0, 500),
        ...errorDetails,
      } : undefined,
    });
  }
};

export default extractId;
