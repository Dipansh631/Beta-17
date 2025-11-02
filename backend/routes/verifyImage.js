import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Verify image using LLaVA (Vision-Language Model)
 * Uses llava-hf/llava-1.5-7b-hf for vision-language understanding
 * 
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg')
 * @param {Array} conditions - Array of NGO conditions with title and description
 * @param {boolean} requireStrictMatch - Whether to require strict matching
 * @returns {Promise<Object>} Verification result
 */
const verifyImageWithLLaVA = async (imageBuffer, conditions = [], requireStrictMatch = false) => {
  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    
    // Prepare Python script path
    const pythonScript = path.join(__dirname, '..', 'verifyImageLLaVA.py');
    
    // Prepare input data
    const inputData = JSON.stringify({
      image: base64Image,
      conditions: conditions,
      requireStrictMatch: requireStrictMatch
    });
    
    console.log('🤖 Verifying image with LLaVA model (llava-1.5-7b-hf)...');
    console.log(`   Conditions to check: ${conditions.length}`);
    
    // Determine Python command (handle both Windows and Unix)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Call Python script
    const { stdout, stderr } = await execAsync(
      `"${pythonCmd}" "${pythonScript}"`,
      {
        input: inputData,
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large images and model responses
        timeout: 120000, // 120 second timeout (model loading takes time)
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
      throw new Error(result.error || 'LLaVA verification failed');
    }
    
    console.log('✅ LLaVA verification completed');
    console.log(`   Satisfies conditions: ${result.satisfiesConditions}`);
    console.log(`   Condition matches: ${result.conditionMatches || 'None'}`);
    console.log(`   Confidence: ${result.confidence}%`);
    
    return result;
    
  } catch (error) {
    console.error('❌ LLaVA verification error:', error.message);
    throw error;
  }
};

/**
 * Main image verification function
 * Uses LLaVA model for vision-language understanding
 * NOTE: Function name kept as verifyImageWithGemini for backward compatibility,
 * but it actually uses LLaVA model now.
 */
export const verifyImageWithGemini = async (imageBuffer, mimeType, conditions = [], requireStrictMatch = false) => {
  try {
    console.log('🤖 Running LLaVA model verification...');
    console.log('   Using: llava-hf/llava-1.5-7b-hf');
    const result = await verifyImageWithLLaVA(imageBuffer, conditions, requireStrictMatch);
    
    console.log('✅ LLaVA verification completed');
    console.log(`   Verification Status: ${result.verificationStatus || (result.satisfiesConditions ? 'VERIFIED' : 'NOT VERIFIED')}`);
    console.log(`   Result: ${result.satisfiesConditions ? 'PASS' : 'FAIL'} (${result.confidence}% confidence)`);
    
    // Handle verification status
    const verificationStatus = result.verificationStatus || (result.satisfiesConditions ? 'VERIFIED' : 'NOT VERIFIED');
    
    // Apply strict 90% confidence threshold for VERIFIED status
    if (verificationStatus === 'VERIFIED' && result.confidence < 90) {
      console.log(`❌ REJECTED: Confidence too low for VERIFIED (${result.confidence}% < 90%)`);
      return {
        ...result,
        satisfiesConditions: false,
        verificationStatus: 'NOT VERIFIED',
        reasoning: `REJECTED: Confidence ${result.confidence}% below 90% threshold (required: 90% accuracy). ${result.reasoning || ''}`,
        verificationMethod: 'llava-1.5-7b-hf'
      };
    }
    
    // PARTIALLY VERIFIED is also considered as not satisfying conditions (needs manual review)
    if (verificationStatus === 'PARTIALLY VERIFIED') {
      console.log(`⚠️  PARTIALLY VERIFIED: Some conditions met but not all (${result.confidence}%)`);
      return {
        ...result,
        satisfiesConditions: false,  // Partial doesn't satisfy requirements
        verificationStatus: 'PARTIALLY VERIFIED',
        reasoning: `PARTIALLY VERIFIED: ${result.reasoning || 'Some but not all conditions met. Requires manual review.'}`,
        verificationMethod: 'llava-1.5-7b-hf'
      };
    }
    
    // Return result
    return {
      ...result,
      verificationStatus: verificationStatus,
      verificationMethod: 'llava-1.5-7b-hf'
    };
    
  } catch (error) {
    console.error('❌ LLaVA verification error:', error.message);
    // Provide helpful error message
    if (error.message.includes('python') || error.message.includes('transformers')) {
      console.error('   ⚠️  Python dependencies may not be installed');
      console.error('   Fix: pip install -r backend/requirements_verification.txt');
    }
    throw error;
  }
};
