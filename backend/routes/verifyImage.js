import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize Gemini AI
let genAI = null;
try {
  if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI initialized for image verification');
  }
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
}

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not set. Image verification will be disabled.');
}

/**
 * Verify image using Gemini AI
 * 1. Check if image satisfies NGO conditions
 * 2. Detect if image is AI-generated
 * 
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg')
 * @param {Array} conditions - Array of NGO conditions with title and description
 * @returns {Promise<Object>} Verification result
 */
export const verifyImageWithGemini = async (imageBuffer, mimeType, conditions = [], requireStrictMatch = false) => {
  if (!GEMINI_API_KEY || !genAI) {
    console.warn('⚠️ GEMINI_API_KEY not configured or genAI not initialized');
    throw new Error('GEMINI_API_KEY not configured. Image verification unavailable.');
  }
  
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Image buffer is empty or invalid');
  }
  
  if (!mimeType || !mimeType.startsWith('image/')) {
    throw new Error('Invalid image MIME type');
  }

  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    // Prepare conditions text
    const conditionsText = conditions.length > 0
      ? conditions.map((cond, idx) => `${idx + 1}. ${cond.title}: ${cond.description || ''}`).join('\n')
      : 'General NGO work activities';

          // Enhanced prompt for strict condition matching
          const strictMatchInstruction = requireStrictMatch 
            ? `\n\nSTRICT MATCHING MODE (REQUIRED):
          - This image MUST show work directly related to ONE or MORE of the specific conditions listed above
          - The image content should demonstrate activities described in the condition descriptions
          - Be REASONABLE: If the image clearly shows NGO work that could reasonably relate to any of the conditions, return satisfiesConditions: true
          - Return satisfiesConditions: true if the image shows:
            * Work that could reasonably be related to any listed condition (even if not explicitly described)
            * Activities that align with the general purpose of the conditions
            * Real NGO work that demonstrates progress on similar goals
          - Return satisfiesConditions: false ONLY if the image shows:
            * Completely unrelated content (not NGO work at all)
            * Work that has nothing to do with the listed conditions
            * Generic stock photos or promotional materials
          - BE LENIENT with condition matching - it's better to accept relevant work than reject legitimate NGO activities`
            : '';

    // Create prompt for Gemini
    const prompt = `You are an expert image verification system. Analyze this image and provide a JSON response with the following structure:
{
  "satisfiesConditions": boolean,
  "conditionMatches": string or null,
  "isAIGenerated": boolean,
  "confidence": number (0-100),
  "reasoning": string,
  "details": {
    "whatIsInImage": string,
    "whyItMatchesOrNot": string,
    "aiGenerationSigns": string[]
  }
}

CRITERIA:
1. Condition Satisfaction Check:
   - The image should show work/activities related to these NGO conditions:
${conditionsText}${strictMatchInstruction}
   - Check if the image content aligns with any of these conditions
   - Return satisfiesConditions: true only if the image clearly shows work related to at least one condition
   - Return conditionMatches with the matching condition title or null

2. AI Generation Detection (CRITICAL - REJECT IF DETECTED):
   - This is a MANDATORY check - AI-generated images MUST be rejected
   - Look for signs of AI generation including but not limited to:
     * Perfect symmetry or unnaturally perfect compositions
     * Unnatural or inconsistent lighting and shadows
     * Inconsistent details, blurry artifacts, or warping
     * Lack of natural imperfections or too polished appearance
     * Floating or disconnected elements
     * Unrealistic textures or patterns
     * Strange color gradients or saturation
     * Watermarks or metadata suggesting AI tools (DALL-E, Midjourney, Stable Diffusion, etc.)
     * Unnatural hand positions, distorted body parts
     * Text artifacts or garbled text
     * Inconsistent perspective or scale
     * Perfect reflections or lighting without sources
   - Check EXHAUSTIVELY for any indicators of AI generation
   - Return isAIGenerated: true if there are ANY signs of AI generation
   - List ALL specific AI generation signs found in aiGenerationSigns array
   - When in doubt, lean towards marking as AI-generated - better to reject a real photo than accept a fake one

3. Confidence Score:
   - Rate confidence 0-100 based on how clear the image is and how certain you are about your assessment
   - Lower confidence (below 70) if there are ANY doubts about authenticity

IMPORTANT PRIORITY:
1. FIRST CHECK: Is this AI-generated? If YES, immediately return isAIGenerated: true and satisfiesConditions: false
2. SECOND CHECK: Does it match the conditions? Only check if not AI-generated
3. Be EXTREMELY strict with AI detection - if there's ANY doubt, mark as AI-generated
4. Real photos of actual NGO work are required - synthetic or AI-generated images are NOT acceptable
5. Return valid JSON only, no additional text before or after`;

    console.log('🤖 Verifying image with Gemini AI...');
    console.log(`   Conditions to check: ${conditions.length}`);
    
    // Try different Gemini models that support vision (order matters - try most stable first)
    const visionModels = [
      'gemini-1.5-flash',      // Most stable and fast
      'gemini-1.5-pro',        // High quality
    ];

    let model = null;
    let selectedModelName = null;
    let lastModelError = null;

    // Simply get the model object - don't test it
    for (const tryModel of visionModels) {
      try {
        model = genAI.getGenerativeModel({ model: tryModel });
        selectedModelName = tryModel;
        console.log(`   Selected model: ${tryModel}`);
        break;
      } catch (err) {
        console.log(`   Model ${tryModel} failed: ${err.message}`);
        lastModelError = err;
        continue;
      }
    }

    if (!model) {
      const errorMsg = lastModelError?.message || 'Unknown error';
      throw new Error(`No vision-capable Gemini models available. Error: ${errorMsg}. Check your API key and ensure GEMINI_API_KEY is set in .env. Try models: gemini-1.5-flash, gemini-1.5-pro`);
    }
    
    console.log(`   Using model: ${selectedModelName}`);

    // Send image to Gemini
    console.log('   Sending image to Gemini Vision API...');
    console.log(`   Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   MIME type: ${mimeType}`);
    
    let result;
    try {
      result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        prompt,
      ]);
    } catch (apiError) {
      console.error('❌ Gemini API call failed:', apiError.message);
      console.error('   Error name:', apiError.name);
      console.error('   Error code:', apiError.code);
      
      // More specific error messages
      let errorMessage = apiError.message || 'Failed to process image';
      
      if (apiError.message?.includes('API_KEY_INVALID') || 
          apiError.message?.includes('403') ||
          apiError.message?.includes('API key')) {
        errorMessage = 'Invalid Gemini API key. Please check GEMINI_API_KEY in .env';
      } else if (apiError.message?.includes('429') || apiError.message?.includes('quota')) {
        errorMessage = 'Gemini API quota exceeded. Please check your API usage limits.';
      } else if (apiError.message?.includes('model') || 
                 apiError.message?.includes('not found') ||
                 apiError.message?.includes('supported methods') ||
                 apiError.message?.includes('available models')) {
        // Model configuration error - this is a setup issue, not a verification failure
        errorMessage = `Model configuration error: ${apiError.message || 'The selected model may not support vision or may not be available with your API key.'}`;
        throw new Error(errorMessage);
      } else {
        throw new Error(`Gemini API error: ${errorMessage}`);
      }
    }

    const response = await result.response;
    let responseText;
    try {
      responseText = await response.text();
    } catch (textError) {
      console.error('❌ Failed to get text from response:', textError);
      throw new Error('Failed to get response from Gemini API');
    }
    
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from Gemini API');
    }
    
    console.log('✅ Gemini verification response received');
    console.log('   Response preview:', responseText.substring(0, 300) + '...');

    // Parse JSON from response
    let verificationResult;
    try {
      // Extract JSON from response (may have markdown code blocks)
      let jsonText = responseText.trim();
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      jsonText = jsonText.trim();
      
      // Find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      verificationResult = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini JSON:', parseError.message);
      console.error('   Raw Gemini response:', responseText);
      
      // Fallback: Try to extract key information from text with enhanced AI detection
      const lowerText = responseText.toLowerCase();
      const isAIGenerated = lowerText.includes('ai-generated') || 
                           lowerText.includes('artificially generated') ||
                           lowerText.includes('synthetic') ||
                           lowerText.includes('generated by ai') ||
                           lowerText.includes('ai creation') ||
                           lowerText.includes('dall-e') ||
                           lowerText.includes('midjourney') ||
                           lowerText.includes('stable diffusion') ||
                           lowerText.includes('computer-generated') ||
                           (lowerText.includes('digital art') && lowerText.includes('generated')) ||
                           lowerText.includes('not a real photo') ||
                           (lowerText.includes('fake') && (lowerText.includes('image') || lowerText.includes('photo')));
      
      const satisfiesConditions = !responseText.toLowerCase().includes('does not match') &&
                                 !responseText.toLowerCase().includes('unrelated');
      
      verificationResult = {
        satisfiesConditions,
        conditionMatches: null,
        isAIGenerated,
        confidence: 50,
        reasoning: 'Failed to parse structured response, using text analysis',
        details: {
          whatIsInImage: responseText.substring(0, 200),
          whyItMatchesOrNot: 'Could not parse detailed analysis',
          aiGenerationSigns: isAIGenerated ? ['Could not parse detailed signs'] : []
        }
      };
    }

    console.log('✅ Image verification completed');
    console.log(`   Satisfies conditions: ${verificationResult.satisfiesConditions}`);
    console.log(`   AI-generated: ${verificationResult.isAIGenerated}`);
    console.log(`   Confidence: ${verificationResult.confidence}%`);

    return verificationResult;
  } catch (error) {
    console.error('❌ Gemini Image Verification Error:', error);
    throw new Error(`Image verification failed: ${error.message || 'Unknown error'}`);
  }
};

export default verifyImageWithGemini;

