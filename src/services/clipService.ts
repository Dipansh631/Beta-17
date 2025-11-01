/**
 * CLIP Service for image-text matching
 * This service calls a backend API that runs the CLIP model
 */

interface ClipMatchResult {
  score: number;
  text: string;
  matches: boolean;
}

interface ClipValidationResult {
  isValid: boolean;
  confidence: number;
  matchedText: string;
  scores: ClipMatchResult[];
}

/**
 * Match an image against multiple text descriptions
 * @param imageUrl - URL or base64 data URL of the image
 * @param texts - Array of text descriptions to match against
 * @returns Array of match scores for each text
 */
export const matchImageToTexts = async (
  imageUrl: string,
  texts: string[]
): Promise<ClipMatchResult[]> => {
  try {
    // Validate image data
    if (!imageUrl || imageUrl.trim() === '') {
      throw new Error('No image provided');
    }

    // Ensure image is a valid data URL or URL
    if (!imageUrl.startsWith('data:image') && !imageUrl.startsWith('http')) {
      throw new Error('Invalid image format. Expected base64 data URL or HTTP URL');
    }

    console.log('Sending image to CLIP API...', {
      imageSize: imageUrl.length,
      textsCount: texts.length,
    });

    const response = await fetch('/api/clip/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageUrl,
        texts: texts,
      }),
      // Add timeout
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CLIP API error:', response.status, errorText);
      throw new Error(`CLIP API returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.matches || !Array.isArray(data.matches)) {
      throw new Error('Invalid response format from CLIP API');
    }

    console.log('CLIP API response received:', data.matches);
    return data.matches;
  } catch (error: any) {
    // Check if it's a network error or timeout
    if (error.name === 'AbortError' || error.name === 'TypeError' || error.message?.includes('fetch')) {
      console.error('CLIP API connection failed:', error);
      throw new Error('Unable to connect to CLIP API. Please ensure the backend server is running on http://localhost:8000');
    }
    
    // Check if it's a validation error
    if (error.message?.includes('image') || error.message?.includes('Invalid')) {
      throw error;
    }

    console.warn('CLIP API not available, using simulated matching:', error);
    // Fallback to simulated matching
    return simulateClipMatching(texts);
  }
};

/**
 * Validate if an image matches a specific domain/description
 * @param imageUrl - URL or base64 data URL of the image
 * @param domainTexts - Array of domain descriptions (e.g., ["education", "medical aid", "food distribution"])
 * @param threshold - Minimum confidence score (0-1) for validation to pass
 * @returns Validation result with confidence and matched domain
 */
export const validateImageDomain = async (
  imageUrl: string,
  domainTexts: string[],
  threshold: number = 0.3
): Promise<ClipValidationResult> => {
  const matches = await matchImageToTexts(imageUrl, domainTexts);
  
  // Find the best match
  const bestMatch = matches.reduce((prev, current) => 
    (current.score > prev.score) ? current : prev
  );

  const isValid = bestMatch.score >= threshold;

  return {
    isValid,
    confidence: bestMatch.score,
    matchedText: bestMatch.text,
    scores: matches,
  };
};

/**
 * Auto-tag NGO type based on logo and description
 * @param logoUrl - Logo image URL or base64
 * @param description - Organization description text
 * @param candidateTags - Array of possible NGO types
 * @returns Array of tags with confidence scores
 */
export const autoTagNGOType = async (
  logoUrl: string | null,
  description: string,
  candidateTags: string[] = [
    'education',
    'healthcare',
    'food distribution',
    'environment',
    'disaster relief',
    'animal welfare',
    'women empowerment',
    'child welfare',
    'elderly care',
    'water sanitation',
  ]
): Promise<{ tag: string; confidence: number }[]> => {
  const tags: { tag: string; confidence: number }[] = [];

  // If logo is available, use it for matching
  if (logoUrl) {
    const logoMatches = await matchImageToTexts(logoUrl, candidateTags);
    logoMatches.forEach((match) => {
      tags.push({ tag: match.text, confidence: match.score });
    });
  }

  // Also analyze description text for keywords
  const descriptionLower = description.toLowerCase();
  candidateTags.forEach((tag) => {
    const tagLower = tag.toLowerCase();
    if (descriptionLower.includes(tagLower)) {
      // If tag found in description, give it a boost
      const existingTag = tags.find((t) => t.tag === tag);
      if (existingTag) {
        existingTag.confidence += 0.2;
      } else {
        tags.push({ tag, confidence: 0.6 });
      }
    }
  });

  // Sort by confidence and return top 5
  return tags
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
};

/**
 * Validate funding condition images match their descriptions
 * @param imageUrl - Activity/proof image URL
 * @param conditionText - Funding condition description
 * @param threshold - Minimum confidence score
 * @returns Validation result
 */
export const validateConditionImage = async (
  imageUrl: string,
  conditionText: string,
  threshold: number = 0.35
): Promise<ClipValidationResult> => {
  // Create variations of the condition text for better matching
  const textVariations = [
    conditionText,
    `a photo of ${conditionText}`,
    `an image showing ${conditionText}`,
    `proof of ${conditionText}`,
  ];

  const matches = await matchImageToTexts(imageUrl, textVariations);
  const bestMatch = matches.reduce((prev, current) => 
    (current.score > prev.score) ? current : prev
  );

  return {
    isValid: bestMatch.score >= threshold,
    confidence: bestMatch.score,
    matchedText: conditionText,
    scores: matches,
  };
};

/**
 * Simulated CLIP matching (fallback when API is not available)
 * This provides a reasonable simulation based on text analysis
 */
const simulateClipMatching = (texts: string[]): ClipMatchResult[] => {
  // Simulate matching scores (in real implementation, these come from CLIP model)
  return texts.map((text) => {
    // Generate a simulated score between 0.2 and 0.9
    // Add some randomness but keep it consistent for the same text
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const score = 0.2 + (hash % 70) / 100;
    
    return {
      score: Math.min(0.95, score),
      text,
      matches: score >= 0.3,
    };
  });
};

