import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables (they're already loaded in server.js, but ensuring availability)
const PDFCO_API_KEY = process.env.PDFCO_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize Gemini AI
let genAI = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Gemini AI:', error.message);
  }
} else {
  console.warn('⚠️ GEMINI_API_KEY not set. Gemini features will be disabled.');
}

/**
 * Extract ID information from a file URL using PDF.co OCR and Gemini AI
 * 
 * Flow:
 * 1. Receive file URL from Firebase Storage
 * 2. Use PDF.co API to extract text via OCR
 * 3. Use Gemini AI to structure the extracted text into JSON
 * 4. Return structured data to frontend
 */
const extractId = async (req, res) => {
  try {
    // Validate request body
    const { fileUrl, fileName, fileType } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'No file URL provided. Please upload file first.',
      });
    }

    // If fileUrl is a MongoDB file endpoint, convert to full URL
    let processedFileUrl = fileUrl;
    if (fileUrl.startsWith('/api/file/')) {
      // It's a MongoDB file endpoint, convert to full URL
      const host = req.get('host');
      const protocol = req.protocol;
      processedFileUrl = `${protocol}://${host}${fileUrl}`;
      console.log('📄 Converting MongoDB file URL to full URL:', processedFileUrl);
    }

    // Validate API keys
    if (!PDFCO_API_KEY) {
      console.error('❌ PDFCO_API_KEY not configured');
      return res.status(500).json({
        success: false,
        message: 'PDFCO_API_KEY not configured. Please set PDFCO_API_KEY in .env',
      });
    }

    if (!GEMINI_API_KEY || !genAI) {
      console.error('❌ GEMINI_API_KEY not configured or Gemini AI not initialized');
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY not configured. Please set GEMINI_API_KEY in .env',
      });
    }

    console.log('📤 Starting ID extraction process...');
    console.log('📄 File URL:', processedFileUrl);
    console.log('📋 File Name:', fileName || 'N/A');
    console.log('📦 File Type:', fileType || 'N/A');

    // Step 1: Extract text using PDF.co OCR
    console.log('🔍 Step 1: Extracting text using PDF.co OCR...');
    
    let extractedText = '';
    const isImage = fileType && fileType.startsWith('image/');
    const isPDF = fileType && fileType === 'application/pdf';

    try {
      if (isImage) {
        // Image OCR
        console.log('   Using PDF.co OCR for image...');
        const ocrResponse = await axios.post(
          'https://api.pdf.co/v1/pdf/recognize',
          {
            url: processedFileUrl,
            inline: true,
            outputFormat: 'json',
          },
          {
            headers: {
              'x-api-key': PDFCO_API_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 60 second timeout
          }
        );

        console.log('   OCR Response Status:', ocrResponse.status);
        
        // Extract text from OCR result
        if (ocrResponse.data.body) {
          try {
            let ocrData;
            if (typeof ocrResponse.data.body === 'string') {
              ocrData = JSON.parse(ocrResponse.data.body);
            } else {
              ocrData = ocrResponse.data.body;
            }

            // Handle different OCR response formats
            if (ocrData.Pages && Array.isArray(ocrData.Pages)) {
              extractedText = ocrData.Pages
                .map((page) => {
                  if (page.TextBlocks && Array.isArray(page.TextBlocks)) {
                    return page.TextBlocks.map((block) => block.Text || '').join(' ');
                  }
                  return '';
                })
                .join('\n');
            } else if (ocrData.Text) {
              extractedText = ocrData.Text;
            } else if (typeof ocrResponse.data.body === 'string') {
              extractedText = ocrResponse.data.body;
            } else {
              extractedText = JSON.stringify(ocrResponse.data.body);
            }
          } catch (parseError) {
            console.error('   Error parsing OCR response:', parseError.message);
            extractedText = typeof ocrResponse.data.body === 'string' 
              ? ocrResponse.data.body 
              : JSON.stringify(ocrResponse.data.body);
          }
        } else if (ocrResponse.data.url) {
          // Fetch result from URL if provided
          console.log('   Fetching OCR result from URL...');
          const textResponse = await axios.get(ocrResponse.data.url, {
            headers: { 'x-api-key': PDFCO_API_KEY },
            timeout: 30000,
          });
          const ocrData = textResponse.data;
          if (ocrData.Pages && Array.isArray(ocrData.Pages)) {
            extractedText = ocrData.Pages
              .map((page) => {
                if (page.TextBlocks && Array.isArray(page.TextBlocks)) {
                  return page.TextBlocks.map((block) => block.Text || '').join(' ');
                }
                return '';
              })
              .join('\n');
          } else if (ocrData.Text) {
            extractedText = ocrData.Text;
          } else {
            extractedText = JSON.stringify(ocrData);
          }
        }
      } else if (isPDF) {
        // PDF to text conversion
        console.log('   Using PDF.co PDF to text conversion...');
        const ocrResponse = await axios.post(
          'https://api.pdf.co/v1/pdf/convert/to/text',
          {
            url: processedFileUrl,
            inline: true,
          },
          {
            headers: {
              'x-api-key': PDFCO_API_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          }
        );

        if (ocrResponse.data.body) {
          extractedText = ocrResponse.data.body;
        } else if (ocrResponse.data.url) {
          const textResponse = await axios.get(ocrResponse.data.url, {
            headers: { 'x-api-key': PDFCO_API_KEY },
            timeout: 30000,
          });
          extractedText = textResponse.data;
        }
      } else {
        throw new Error('Unsupported file type. Please upload JPG, PNG, or PDF.');
      }
    } catch (ocrError) {
      console.error('❌ PDF.co OCR Error:', ocrError.response?.data || ocrError.message);
      const errorMessage = ocrError.response?.data?.message || ocrError.message || 'PDF.co OCR failed';
      throw new Error(`PDF.co OCR failed: ${errorMessage}`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('PDF.co extraction failed: No text extracted from document');
    }

    console.log('✅ Step 1 Complete: Text extracted successfully');
    console.log('📄 Extracted text preview:', extractedText.substring(0, 200) + '...');

    // Step 2: Use Gemini AI to structure the extracted text
    console.log('🤖 Step 2: Using Gemini AI to structure extracted text...');

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `Extract and structure Indian ID document details from the following OCR text.

Return ONLY valid JSON format with these exact keys (no markdown, no explanations):
{
  "name": "Full name as it appears on the document",
  "dob": "Date of birth in DD-MM-YYYY format",
  "gender": "Male, Female, or Transgender",
  "address": "Complete address as shown on document",
  "id_number": "ID number (Aadhaar number or PAN number)",
  "id_type": "Aadhaar" or "PAN"
}

OCR Text extracted from document:
${extractedText.substring(0, 3000)} ${extractedText.length > 3000 ? '...' : ''}

Important instructions:
- Return ONLY the JSON object, no markdown code blocks, no explanations
- If any field cannot be found, use empty string ""
- For id_type, determine if it's "Aadhaar" or "PAN" based on the ID number format
- Date format must be DD-MM-YYYY
- Extract the complete address including street, city, state, pincode if available
- Name should be the full name as printed on the document`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const geminiText = response.text();

      console.log('   Gemini Response received:', geminiText.substring(0, 200) + '...');

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
        throw new Error(`Failed to parse structured data from Gemini: ${parseError.message}`);
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
      console.error('❌ Gemini AI Error:', geminiError);
      throw new Error(`Gemini AI failed: ${geminiError.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ Error in extractId route:', error);
    console.error('   Error Type:', error.constructor.name);
    console.error('   Error Message:', error.message);
    console.error('   Error Stack:', error.stack);

    // Provide user-friendly error message
    let errorMessage = 'Failed to extract ID information';
    let statusCode = 500;

    if (error.response) {
      // API error (PDF.co or Gemini)
      statusCode = error.response.status || 500;
      errorMessage = error.response.data?.message || error.message;
    } else if (error.message) {
      errorMessage = error.message;
      if (error.message.includes('not configured')) {
        statusCode = 500;
      } else if (error.message.includes('No file URL')) {
        statusCode = 400;
      } else if (error.message.includes('Unsupported file type')) {
        statusCode = 400;
      }
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        stack: error.stack,
        response: error.response?.data,
      } : undefined,
    });
  }
};

export default extractId;
