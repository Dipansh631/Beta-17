import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
/**
 * Check AI generation using Gemini (lighter check, just for AI detection)
 */
const checkAIGenerationWithGemini = async (base64Image, mimeType) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze this image and check ONLY for AI generation signs. Return JSON:
{
  "isAIGenerated": boolean,
  "aiGenerationSigns": string[]
}`;

    const result = await model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      prompt
    ]);
    
    const responseText = await result.response.text();
    let jsonText = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];
    
    const aiCheck = JSON.parse(jsonText);
    return aiCheck;
  } catch (error) {
    console.warn('AI generation check error:', error.message);
    return { isAIGenerated: false }; // Default to not AI if check fails
  }
};

/**
 * Verify image using CLIP (Python deep learning model)
 * More accurate than Gemini for condition matching
 */
const verifyImageWithCLIP = async (imageBuffer, conditions = [], requireStrictMatch = false) => {
  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    
    // Prepare Python script path
    const pythonScript = path.join(__dirname, '..', 'verifyImageCLIP.py');
    
    // Prepare input data
    const inputData = JSON.stringify({
      image: base64Image,
      conditions: conditions,
      requireStrictMatch: requireStrictMatch
    });
    
    console.log('🤖 Verifying image with CLIP model...');
    console.log(`   Conditions to check: ${conditions.length}`);
    
    // Determine Python command (handle both Windows and Unix)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Call Python script
    const { stdout, stderr } = await execAsync(
      `"${pythonCmd}" "${pythonScript}"`,
      {
        input: inputData,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large images
        timeout: 60000, // 60 second timeout
        shell: true
      }
    );
    
    // Log stderr (Python debug output)
    if (stderr) {
      console.log('   Python output:', stderr);
    }
    
    // Parse JSON response
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      throw new Error(result.error || 'CLIP verification failed');
    }
    
    console.log('✅ CLIP verification completed');
    console.log(`   Satisfies conditions: ${result.satisfiesConditions}`);
    console.log(`   Condition matches: ${result.conditionMatches || 'None'}`);
    console.log(`   Confidence: ${result.confidence}%`);
    
    return result;
    
  } catch (error) {
    console.error('❌ CLIP verification error:', error.message);
    // Fallback to Gemini if CLIP fails
    console.log('   Falling back to Gemini verification...');
    throw error; // Will be caught and fallback to Gemini
  }
};

/**
 * Get full Gemini verification (AI detection + condition matching)
 */
const getFullGeminiVerification = async (base64Image, mimeType, conditions = [], requireStrictMatch = false) => {
  if (!GEMINI_API_KEY || !genAI) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  
  // Prepare conditions text with detailed format
  const conditionsText = conditions.length > 0
    ? conditions.map((cond, idx) => {
        const title = cond.title || 'Untitled Condition';
        const description = cond.description || 'No description provided';
        return `${idx + 1}. CONDITION: "${title}"
 Description: ${description}
 You must verify if the image shows work SPECIFICALLY related to this condition.`;
      }).join('\n\n')
    : 'General NGO work activities (no specific conditions provided)';

  // Enhanced prompt for strict condition matching with explicit per-condition analysis
  const conditionListForPrompt = conditions.map((cond, idx) => {
    const title = cond.title || 'Untitled';
    const desc = cond.description || '';
    return `Condition ${idx + 1}: "${title}"
   - Description: ${desc}
   - You MUST check: Does this image show "${title}" activities? Specifically: ${desc}`;
  }).join('\n\n');

  const strictMatchInstruction = requireStrictMatch 
    ? `\n\n🔴🔴🔴 CRITICAL: STRICT CONDITION MATCHING - ZERO TOLERANCE FOR MISMATCHES 🔴🔴🔴

You MUST analyze this image against EACH condition below and provide explicit match/no-match for EACH:

${conditionListForPrompt}

MANDATORY ANALYSIS STEPS (DO NOT SKIP):
1. Look at the image - What do you ACTUALLY see? Describe it in detail.
2. For EACH condition above, check:
   - Does the image show activities mentioned in condition title: "[title]"?
   - Does the image demonstrate work described in: "[description]"?
   - Is there a DIRECT visual match? (Can you see the condition's activities in the image?)

RETURN satisfiesConditions: true ONLY IF:
✓ The image VISUALLY shows work that DIRECTLY matches at least ONE specific condition
✓ You can CLEARLY see elements mentioned in the condition title and description in the image
✓ The match is OBVIOUS and doesn't require interpretation or assumptions

RETURN satisfiesConditions: false IF:
✗ The image shows generic NGO/disaster relief work but doesn't match any specific condition
✗ The image shows different activities than described in conditions
✗ You cannot clearly see the condition's specific activities in the image
✗ The match requires assumptions or interpretation - REJECT

Be EXTREME LY STRICT - Better to reject 10 images than approve 1 wrong match.`
    : `\n\n⚠️ CONDITION MATCHING (NON-STRICT MODE):
      - Check if image shows work related to the listed conditions
      - Be reasonable but verify there is some connection`;

  // Create comprehensive prompt for Gemini
  const prompt = `You are a strict image verification system for NGO work proof verification. Your job is to verify that images show work SPECIFICALLY related to allocated funding conditions.

ANALYZE THIS IMAGE CAREFULLY and provide a JSON response with this EXACT structure:
{
  "satisfiesConditions": boolean,
  "conditionMatches": string or null,
  "isAIGenerated": boolean,
  "confidence": number (0-100),
  "reasoning": string,
  "details": {
    "whatIsInImage": string,
    "whyItMatchesOrNot": string,
    "aiGenerationSigns": string[],
    "conditionAnalysis": string[]
  }
}

STEP 1: AI GENERATION DETECTION (MANDATORY - CHECK FIRST):
Look EXHAUSTIVELY for these AI generation indicators:
- Perfect symmetry or unnaturally perfect compositions
- Unnatural or inconsistent lighting and shadows
- Inconsistent details, blurry artifacts, or warping
- Lack of natural imperfections or overly polished appearance
- Floating or disconnected elements
- Unrealistic textures or patterns
- Strange color gradients or saturation
- Watermarks or metadata suggesting AI tools
- Unnatural hand positions, distorted body parts, extra fingers
- Text artifacts or garbled text
- Inconsistent perspective or scale

IF ANY of these signs are present, return isAIGenerated: true immediately.
List ALL specific signs found in the aiGenerationSigns array.

STEP 2: CONDITION MATCHING (ONLY IF NOT AI-GENERATED):
${conditions.length > 0 ? `Verify if this image matches these SPECIFIC NGO conditions:

${conditionsText}` : 'No specific conditions provided - verify if image shows legitimate NGO work.'}

${strictMatchInstruction}

STEP 3: CONFIDENCE SCORE (CRITICAL - 90% MINIMUM REQUIRED):
- You MUST rate confidence 0-100 based on clarity and certainty
- **IMPORTANT: Only return satisfiesConditions: true if confidence is 90% or higher**
- If confidence is below 90%, you MUST return satisfiesConditions: false
- Rate below 90 if there are ANY doubts, uncertainties, or vague connections
- Only assign 90%+ confidence when you are ABSOLUTELY CERTAIN the image matches a specific condition
- Be extremely conservative - it's better to reject than approve with uncertainty

STEP 4: REASONING:
Provide clear explanation:
- What is actually shown in the image
- Which condition(s) it matches (if any) and why
- Which condition(s) it does NOT match and why
- Any concerns or doubts

CRITICAL FINAL INSTRUCTIONS:
1. Check AI generation FIRST - if detected, reject immediately
2. Be EXTREMELY STRICT with condition matching - vague connections are NOT matches
3. Only approve if image clearly shows work related to SPECIFIC conditions (not generic NGO work)
4. **MANDATORY: Confidence must be 90%+ to approve. If below 90%, set satisfiesConditions: false**
5. Return ONLY valid JSON, no markdown, no code blocks, no additional text

Return the JSON response now:`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      prompt
    ]);
    
    const responseText = await result.response.text();
    let jsonText = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];
    
    const geminiResult = JSON.parse(jsonText);
    return geminiResult;
  } catch (error) {
    console.error('Gemini verification error:', error.message);
    throw error;
  }
};

export const verifyImageWithGemini = async (imageBuffer, mimeType, conditions = [], requireStrictMatch = false) => {
  // Use BOTH CLIP and Gemini for comprehensive verification
  let clipResult = null;
  let geminiResult = null;
  
  // Step 1: Run CLIP verification (condition matching)
  try {
    console.log('🤖 Step 1: Running CLIP verification...');
    clipResult = await verifyImageWithCLIP(imageBuffer, conditions, requireStrictMatch);
    console.log('✅ CLIP verification completed');
    console.log(`   CLIP Result: ${clipResult.satisfiesConditions ? 'PASS' : 'FAIL'} (${clipResult.confidence}% confidence)`);
  } catch (clipError) {
    console.warn('⚠️ CLIP verification failed:', clipError.message);
    console.warn('   Continuing with Gemini-only verification...');
  }
  
  // Step 2: Run Gemini verification (AI detection + condition matching)
  if (GEMINI_API_KEY && genAI) {
    try {
      console.log('🤖 Step 2: Running Gemini verification...');
      const base64Image = imageBuffer.toString('base64');
      geminiResult = await getFullGeminiVerification(base64Image, mimeType, conditions, requireStrictMatch);
      console.log('✅ Gemini verification completed');
      console.log(`   Gemini Result: ${geminiResult.satisfiesConditions ? 'PASS' : 'FAIL'} (${geminiResult.confidence}% confidence)`);
      console.log(`   AI Generated: ${geminiResult.isAIGenerated ? 'YES ❌' : 'NO ✅'}`);
    } catch (geminiError) {
      console.warn('⚠️ Gemini verification failed:', geminiError.message);
    }
  } else {
    console.warn('⚠️ Gemini API key not configured, skipping Gemini verification');
  }
  
  // Step 3: Combine results from both models
  if (!clipResult && !geminiResult) {
    throw new Error('Both CLIP and Gemini verification failed. Please check configurations.');
  }
  
  // If only one model succeeded, use that result
  if (!clipResult && geminiResult) {
    console.log('📊 Using Gemini-only result (CLIP unavailable)');
    return geminiResult;
  }
  
  if (clipResult && !geminiResult) {
    console.log('📊 Using CLIP-only result (Gemini unavailable)');
    return clipResult;
  }
  
  // Both models succeeded - combine results
  console.log('📊 Combining results from both CLIP and Gemini...');
  
  // Reject if either model says AI-generated
  if (geminiResult.isAIGenerated) {
    console.log('❌ REJECTED: Gemini detected AI-generated image');
    return {
      ...clipResult,
      satisfiesConditions: false,
      isAIGenerated: true,
      reasoning: `REJECTED: AI-generated image detected by Gemini. ${clipResult.reasoning}`,
      verificationMethod: 'dual-verification',
      clipResult: clipResult,
      geminiResult: geminiResult
    };
  }
  
  // MUCH STRICTER: Reject if CLIP confidence is too low (< 90% - user requirement)
  if (clipResult.confidence < 90) {
    console.log(`❌ REJECTED: CLIP confidence too low (${clipResult.confidence}% < 90%)`);
    return {
      ...clipResult,
      satisfiesConditions: false,
      reasoning: `REJECTED: CLIP confidence ${clipResult.confidence}% below 90% threshold (user requirement: 90% accuracy). ${geminiResult.reasoning || ''}`,
      verificationMethod: 'dual-verification',
      clipResult: clipResult,
      geminiResult: geminiResult
    };
  }
  
  // CRITICAL: Verify that CLIP matched condition actually exists in our conditions list
  if (clipResult.satisfiesConditions && clipResult.conditionMatches) {
    const matchedConditionExists = conditions.some(c => {
      const condTitle = (c.title || '').trim().toLowerCase();
      const matchedTitle = (clipResult.conditionMatches || '').trim().toLowerCase();
      return condTitle === matchedTitle || 
             condTitle.includes(matchedTitle) || 
             matchedTitle.includes(condTitle);
    });
    
    if (!matchedConditionExists) {
      console.log(`❌ REJECTED: CLIP matched condition '${clipResult.conditionMatches}' not in provided conditions list`);
      return {
        ...clipResult,
        satisfiesConditions: false,
        reasoning: `REJECTED: Matched condition '${clipResult.conditionMatches}' does not exist in the provided conditions. This is a false positive. ${geminiResult.reasoning || ''}`,
        verificationMethod: 'dual-verification',
        clipResult: clipResult,
        geminiResult: geminiResult
      };
    }
  }
  
  // Reject if Gemini confidence is too low (< 90%)
  if (geminiResult.confidence < 90) {
    console.log(`❌ REJECTED: Gemini confidence too low (${geminiResult.confidence}% < 90%)`);
    return {
      ...clipResult,
      satisfiesConditions: false,
      reasoning: `REJECTED: Gemini confidence ${geminiResult.confidence}% below 90% threshold. CLIP: ${clipResult.confidence}%. ${geminiResult.reasoning || ''}`,
      verificationMethod: 'dual-verification',
      clipResult: clipResult,
      geminiResult: geminiResult
    };
  }
  
  // Both must agree on condition match
  const bothPass = clipResult.satisfiesConditions && geminiResult.satisfiesConditions;
  
  if (!bothPass) {
    console.log('❌ REJECTED: Models disagree on condition match');
    return {
      satisfiesConditions: false,
      conditionMatches: clipResult.conditionMatches || geminiResult.conditionMatches || null,
      confidence: Math.min(clipResult.confidence, geminiResult.confidence),
      isAIGenerated: false,
      reasoning: `REJECTED: Verification disagreement. CLIP: ${clipResult.satisfiesConditions ? 'PASS' : 'FAIL'} (${clipResult.confidence}%), Gemini: ${geminiResult.satisfiesConditions ? 'PASS' : 'FAIL'} (${geminiResult.confidence}%). ${geminiResult.reasoning || clipResult.reasoning}`,
      verificationMethod: 'dual-verification',
      clipResult: clipResult,
      geminiResult: geminiResult
    };
  }
  
  // Both models agree - image passes verification
  console.log('✅ APPROVED: Both CLIP and Gemini agree - image passes verification');
  
  // Combine confidence scores (weighted average: 40% CLIP, 60% Gemini)
  const combinedConfidence = Math.round(
    (clipResult.confidence * 0.4) + (geminiResult.confidence * 0.6)
  );
  
  // Use the condition match from the model with higher confidence
  const bestMatch = clipResult.confidence > geminiResult.confidence 
    ? clipResult.conditionMatches 
    : geminiResult.conditionMatches;
  
  return {
    satisfiesConditions: true,
    conditionMatches: bestMatch,
    confidence: combinedConfidence,
    isAIGenerated: false,
    reasoning: `APPROVED by both CLIP (${clipResult.confidence}%) and Gemini (${geminiResult.confidence}%). Combined confidence: ${combinedConfidence}%. ${geminiResult.reasoning || clipResult.reasoning}`,
    details: {
      whatIsInImage: geminiResult.details?.whatIsInImage || clipResult.details?.whatIsInImage,
      whyItMatchesOrNot: `${geminiResult.details?.whyItMatchesOrNot || ''} | CLIP: ${clipResult.details?.whyItMatchesOrNot || ''}`,
      aiGenerationSigns: geminiResult.details?.aiGenerationSigns || [],
      conditionAnalysis: geminiResult.details?.conditionAnalysis || clipResult.details?.conditionAnalysis || []
    },
    verificationMethod: 'dual-verification',
    clipResult: {
      satisfiesConditions: clipResult.satisfiesConditions,
      confidence: clipResult.confidence,
      conditionMatches: clipResult.conditionMatches
    },
    geminiResult: {
      satisfiesConditions: geminiResult.satisfiesConditions,
      confidence: geminiResult.confidence,
      conditionMatches: geminiResult.conditionMatches,
      isAIGenerated: geminiResult.isAIGenerated
    }
  };
};
