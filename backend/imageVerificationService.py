#!/usr/bin/env python3
"""
Image Verification Service using CLIP (Hugging Face)
This service uses OpenAI's CLIP model for zero-shot image classification
to verify if images match specific NGO conditions with high accuracy.
"""

import sys
import json
import base64
import io
import os
from PIL import Image
from transformers import pipeline, AutoProcessor, AutoModelForZeroShotImageClassification
import torch

# Initialize CLIP model
print("🔄 Initializing CLIP model...", file=sys.stderr)
try:
    # Use pipeline for easier usage
    pipe = pipeline(
        "zero-shot-image-classification",
        model="openai/clip-vit-base-patch32",
        device=0 if torch.cuda.is_available() else -1
    )
    print("✅ CLIP model loaded successfully", file=sys.stderr)
except Exception as e:
    print(f"❌ Failed to load CLIP model: {e}", file=sys.stderr)
    sys.exit(1)


def decode_base64_image(base64_string):
    """Decode base64 string to PIL Image"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        return image
    except Exception as e:
        raise ValueError(f"Failed to decode image: {str(e)}")


def verify_image_with_clip(image_base64, conditions):
    """
    Verify image against conditions using CLIP model
    
    Args:
        image_base64: Base64 encoded image string
        conditions: List of condition objects with 'title' and 'description'
    
    Returns:
        dict with verification results
    """
    try:
        # Decode image
        image = decode_base64_image(image_base64)
        
        # Build candidate labels from conditions
        candidate_labels = []
        for condition in conditions:
            title = condition.get('title', '')
            description = condition.get('description', '')
            # Combine title and description for better matching
            label = f"{title}: {description}" if description else title
            candidate_labels.append(label)
        
        if not candidate_labels:
            return {
                "success": False,
                "error": "No conditions provided"
            }
        
        print(f"🔍 Analyzing image against {len(candidate_labels)} conditions...", file=sys.stderr)
        
        # Run CLIP classification
        results = pipe(image, candidate_labels=candidate_labels)
        
        print(f"✅ CLIP classification completed", file=sys.stderr)
        
        # Sort results by score (highest first)
        results = sorted(results, key=lambda x: x['score'], reverse=True)
        
        # Get best match
        best_match = results[0] if results else None
        
        # Extract condition title from label
        best_match_condition = None
        if best_match:
            label = best_match['label']
            # Extract condition title (before colon)
            condition_title = label.split(':')[0].strip()
            best_match_condition = condition_title
        
        # Determine if image satisfies conditions
        # Require at least 40% confidence for a match (strict threshold)
        confidence_threshold = 0.40
        best_score = best_match['score'] if best_match else 0.0
        
        satisfies_conditions = best_score >= confidence_threshold
        
        # Build detailed analysis
        condition_analysis = []
        for result in results:
            label = result['label']
            score = result['score']
            condition_title = label.split(':')[0].strip()
            match_status = "MATCH" if score >= confidence_threshold else "NO MATCH"
            condition_analysis.append({
                "condition": condition_title,
                "score": round(score * 100, 2),  # Convert to percentage
                "match": match_status,
                "confidence": f"{score * 100:.1f}%"
            })
        
        return {
            "success": True,
            "satisfiesConditions": satisfies_conditions,
            "conditionMatches": best_match_condition if satisfies_conditions else None,
            "confidence": round(best_score * 100, 2),  # Convert to percentage
            "bestMatch": {
                "condition": best_match_condition,
                "score": round(best_score * 100, 2),
                "label": best_match['label'] if best_match else None
            },
            "allMatches": condition_analysis,
            "reasoning": f"CLIP model analysis: Best match is '{best_match_condition}' with {best_score * 100:.1f}% confidence. {'Match found' if satisfies_conditions else 'No match found (below threshold)'}."
        }
        
    except Exception as e:
        print(f"❌ Error in CLIP verification: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            "success": False,
            "error": str(e)
        }


def main():
    """Main function to handle requests from Node.js"""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        image_base64 = input_data.get('image')
        conditions = input_data.get('conditions', [])
        
        if not image_base64:
            result = {
                "success": False,
                "error": "No image provided"
            }
        else:
            result = verify_image_with_clip(image_base64, conditions)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()

