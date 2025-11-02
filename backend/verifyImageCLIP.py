#!/usr/bin/env python3
"""
CLIP-based Image Verification Service
Uses OpenAI's CLIP model for accurate zero-shot image classification
to verify images match specific NGO conditions with high precision.
"""

import sys
import json
import base64
import io
import os
from PIL import Image
from transformers import pipeline
import torch

# Initialize CLIP model once (singleton)
_model = None
_pipe = None

def get_clip_pipeline():
    """Get or initialize CLIP pipeline"""
    global _pipe
    if _pipe is None:
        print("🔄 Initializing CLIP model...", file=sys.stderr)
        try:
            _pipe = pipeline(
                "zero-shot-image-classification",
                model="openai/clip-vit-base-patch32",
                device=0 if torch.cuda.is_available() else -1
            )
            print("✅ CLIP model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"❌ Failed to load CLIP model: {e}", file=sys.stderr)
            raise
    return _pipe


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


def verify_image_with_clip(image_base64, conditions, require_strict_match=False):
    """
    Verify image against conditions using CLIP model
    
    Args:
        image_base64: Base64 encoded image string
        conditions: List of condition objects with 'title' and 'description'
        require_strict_match: If True, use stricter matching threshold
    
    Returns:
        dict with verification results compatible with Gemini format
    """
    try:
        # Decode image
        image = decode_base64_image(image_base64)
        
        # Build candidate labels from conditions
        candidate_labels = []
        condition_map = {}  # Map label to condition object
        
        for condition in conditions:
            title = condition.get('title', '').strip()  # Keep original case for matching
            description = condition.get('description', '').strip()
            title_lower = title.lower()  # Use lowercase for keyword detection
            desc_lower = description.lower() if description else ''
            
            # Create highly specific labels for better CLIP matching
            # CLIP works best with descriptive, specific labels
            
            # Build specific labels based on condition type (use lowercase for detection)
            if 'feed' in title_lower or 'food' in title_lower or 'meal' in title_lower or 'hunger' in title_lower:
                # Feeding-related conditions
                specific_labels = [
                    f"{title}: {description}" if description else title,
                    f"people eating food and meals",
                    f"food distribution and feeding people",
                    f"cooking and preparing meals for people",
                    f"serving food to people",
                    title,
                    description if description else title
                ]
            elif 'travel' in title_lower or 'transport' in title_lower or 'expense' in title_lower or 'vehicle' in title_lower or 'stuck' in title_lower or 'flood' in title_lower:
                # Travel/transport-related conditions
                specific_labels = [
                    f"{title}: {description}" if description else title,
                    f"vehicles and transportation for people",
                    f"people traveling in vehicles",
                    f"evacuation and transport of people",
                    f"travel arrangements and transportation",
                    title,
                    description if description else title
                ]
            elif 'medical' in title_lower or 'health' in title_lower or 'treatment' in title_lower:
                # Medical-related conditions
                specific_labels = [
                    f"{title}: {description}" if description else title,
                    f"medical care and treatment",
                    f"healthcare services",
                    f"medical professionals treating people",
                    title,
                    description if description else title
                ]
            elif 'education' in title_lower or 'school' in title_lower or 'learning' in title_lower:
                # Education-related conditions
                specific_labels = [
                    f"{title}: {description}" if description else title,
                    f"educational activities and learning",
                    f"students in classroom or school",
                    f"teaching and education services",
                    title,
                    description if description else title
                ]
            else:
                # Generic conditions - use title and description
                specific_labels = [
                    f"{title}: {description}" if description else title,
                    description if description else title,
                    title
                ]
            
            # Add all labels and map to original condition
            for label in specific_labels:
                if label and label not in candidate_labels:  # Avoid duplicates
                    candidate_labels.append(label)
                    # Store original condition with original title
                    condition_map[label] = {
                        'title': title,  # Original title (not lowercase)
                        'original_condition': condition
                    }
        
        if not candidate_labels:
            return {
                "success": False,
                "error": "No conditions provided",
                "satisfiesConditions": False
            }
        
        print(f"🔍 Analyzing image against {len(conditions)} conditions...", file=sys.stderr)
        
        # Get CLIP pipeline
        pipe = get_clip_pipeline()
        
        # Run CLIP classification
        results = pipe(image, candidate_labels=candidate_labels)
        
        print(f"✅ CLIP classification completed", file=sys.stderr)
        
        # Sort results by score (highest first)
        results = sorted(results, key=lambda x: x['score'], reverse=True)
        
        # Get best match
        best_match = results[0] if results else None
        best_score = best_match['score'] if best_match else 0.0
        
        # MUCH STRICTER thresholds for accurate verification
        # Require very high confidence to prevent false positives
        if require_strict_match:
            confidence_threshold = 0.90  # 90% minimum for strict matching (user requirement)
        else:
            confidence_threshold = 0.85  # 85% minimum for approval (much stricter)
        
        # Additional check: Require significant gap between best and second-best
        # If multiple conditions, require clear winner
        if len(results) > 1:
            best_score = results[0]['score']
            second_best_score = results[1]['score']
            score_gap = best_score - second_best_score
            
            # If scores are too close (< 15% difference), be MUCH more conservative
            if score_gap < 0.15:
                confidence_threshold = max(confidence_threshold, 0.92)  # Raise to 92%
                print(f"⚠️ Close scores detected (gap: {score_gap*100:.1f}%), using higher threshold 92%", file=sys.stderr)
        
        # CRITICAL: Require minimum absolute score of 90% (user requirement: 90% accuracy)
        # This prevents false positives from low-confidence matches
        absolute_minimum = 0.90  # Changed from 0.85 to 0.90 per user requirement
        if best_score < absolute_minimum:
            satisfies_conditions = False
            print(f"❌ REJECTING: Best score {best_score*100:.1f}% below absolute minimum {absolute_minimum*100}% (user requirement)", file=sys.stderr)
        else:
            # Require BOTH: best_score >= threshold AND best_score >= 90%
            required_threshold = max(confidence_threshold, 0.90)
            satisfies_conditions = best_score >= required_threshold
            if not satisfies_conditions:
                print(f"❌ REJECTING: Best score {best_score*100:.1f}% below required threshold {required_threshold*100}%", file=sys.stderr)
        
        # Find which condition the best match belongs to
        best_match_condition = None
        if best_match:
            label = best_match['label']
            # Find the condition this label belongs to
            matched_info = condition_map.get(label)
            if matched_info:
                best_match_condition = matched_info.get('title', '').strip()
        
        # If no direct match found, try to extract from label
        if not best_match_condition and best_match:
            label = best_match['label']
            # Try to extract condition title from label
            if ':' in label:
                potential_title = label.split(':')[0].strip()
                # Check if this matches any condition title
                for cond in conditions:
                    if cond.get('title', '').strip().lower() == potential_title.lower():
                        best_match_condition = cond.get('title', '').strip()
                        break
                if not best_match_condition:
                    best_match_condition = potential_title
            else:
                # Label might be the condition title itself
                best_match_condition = label
        
        # Build detailed analysis per condition
        condition_analysis = []
        condition_scores = {}  # Aggregate scores per condition
        
        for result in results:
            label = result['label']
            score = result['score']
            
            # Find which condition this belongs to
            matched_info = condition_map.get(label)
            if matched_info:
                condition_title = matched_info.get('title', '').strip()
            else:
                # Try to extract from label
                if ':' in label:
                    condition_title = label.split(':')[0].strip()
                else:
                    condition_title = label
            
            # Aggregate scores for same condition (take highest)
            if condition_title not in condition_scores:
                condition_scores[condition_title] = score
            else:
                condition_scores[condition_title] = max(condition_scores[condition_title], score)
        
        # Build condition analysis array - CRITICAL: Only mark as MATCH if score meets strict threshold
        for condition in conditions:
            condition_title = condition.get('title', '').strip()
            score = condition_scores.get(condition_title, 0.0)
            # Require BOTH: score >= threshold AND score >= 90% (user requirement)
            is_match = (score >= confidence_threshold) and (score >= 0.90)
            match_status = "MATCH" if is_match else "NO MATCH"
            
            condition_analysis.append(
                f"{condition_title}: {match_status} - {score * 100:.1f}% confidence (Required: {max(confidence_threshold * 100, 90):.0f}%)"
            )
            
            # Debug: Log if condition scored but didn't meet threshold
            if score > 0.5 and not is_match:
                print(f"   ⚠️ {condition_title}: Score {score*100:.1f}% but below {max(confidence_threshold*100, 90):.0f}% threshold", file=sys.stderr)
        
        # Convert confidence to percentage
        confidence_percent = round(best_score * 100, 2)
        
        # STRICT VALIDATION: Multiple checks to ensure accurate matching
        
        # Check 1: Verify that best_match_condition actually matches one of our conditions
        if satisfies_conditions and best_match_condition:
            # Check if the matched condition title actually exists in our conditions list
            condition_titles = [cond.get('title', '').strip().lower() for cond in conditions]
            matched_title_lower = best_match_condition.lower()
            
            # Only approve if best match actually corresponds to one of our conditions
            if matched_title_lower not in condition_titles:
                # Check if any part of the matched condition is in our conditions
                found_match = False
                for cond_title in condition_titles:
                    # Check for partial matches (e.g., "Feeding People" matches "Feeding")
                    if cond_title in matched_title_lower or matched_title_lower in cond_title:
                        found_match = True
                        best_match_condition = [c.get('title', '').strip() for c in conditions if c.get('title', '').strip().lower() == cond_title][0]
                        break
                
                if not found_match:
                    satisfies_conditions = False
                    print(f"❌ REJECTING: Matched condition '{best_match_condition}' not in provided conditions list", file=sys.stderr)
        
        # Check 2: Require that at least one condition score meets BOTH threshold AND 90% requirement
        # Get maximum score for any actual condition (not generic labels)
        max_condition_score = 0.0
        best_matching_condition = None
        for condition in conditions:
            condition_title = condition.get('title', '').strip()
            score = condition_scores.get(condition_title, 0.0)
            if score > max_condition_score:
                max_condition_score = score
                best_matching_condition = condition_title
        
        # CRITICAL: Require BOTH conditions to pass
        required_score = max(confidence_threshold, 0.90)  # At least 90% (user requirement)
        
        # If no condition scored above required threshold, reject
        if max_condition_score < required_score:
            satisfies_conditions = False
            print(f"❌ REJECTING: No condition scored above required threshold. Max condition score: {max_condition_score*100:.1f}%, Required: {required_score*100}%", file=sys.stderr)
            print(f"   Best matching condition: {best_matching_condition or 'None'}", file=sys.stderr)
        
        # Also verify that best_match_condition matches the highest scoring actual condition
        if satisfies_conditions and best_matching_condition and best_match_condition:
            # Normalize for comparison
            best_match_norm = best_match_condition.lower().strip()
            best_matching_norm = best_matching_condition.lower().strip()
            
            # Check if they match (exact or partial)
            if best_match_norm != best_matching_norm and not (best_match_norm in best_matching_norm or best_matching_norm in best_match_norm):
                # Mismatch - the model matched something different than what scored highest
                satisfies_conditions = False
                print(f"❌ REJECTING: Condition mismatch. Best match: '{best_match_condition}' but highest scoring condition: '{best_matching_condition}'", file=sys.stderr)
        
        # Check 3: Final strict threshold - require 90%+ for approval (user requirement)
        if satisfies_conditions and best_score < 0.90:
            satisfies_conditions = False
            print(f"❌ REJECTING: Best score {confidence_percent}% below 90% requirement (user requirement)", file=sys.stderr)
        
        # Check 4: Final safety check - this should already be caught by absolute_minimum above
        # But adding as extra safeguard
        if satisfies_conditions and best_score < 0.90:
            satisfies_conditions = False
            print(f"❌ REJECTING: Final check - Best score {confidence_percent}% below 90% requirement", file=sys.stderr)
        
        # Build reasoning
        reasoning_parts = [
            f"CLIP model analysis: Best match is '{best_match_condition}' with {confidence_percent}% confidence.",
            f"Confidence threshold: {confidence_threshold * 100}%",
        ]
        
        if satisfies_conditions:
            reasoning_parts.append(f"Match found: Image shows work related to '{best_match_condition}' condition.")
        else:
            reasoning_parts.append(f"No match found: Confidence below threshold or requirements.")
        
        reasoning = " ".join(reasoning_parts)
        
        return {
            "success": True,
            "satisfiesConditions": satisfies_conditions,
            "conditionMatches": best_match_condition if satisfies_conditions else None,
            "confidence": confidence_percent,
            "isAIGenerated": False,  # CLIP doesn't detect AI generation, rely on Gemini for that
            "reasoning": reasoning,
            "details": {
                "whatIsInImage": f"Best match: {best_match['label'] if best_match else 'Unknown'} ({confidence_percent}%)",
                "whyItMatchesOrNot": reasoning,
                "conditionAnalysis": condition_analysis,
                "allScores": {cond.get('title', ''): round(condition_scores.get(cond.get('title', ''), 0) * 100, 2) 
                             for cond in conditions}
            },
            "bestMatch": {
                "condition": best_match_condition,
                "score": confidence_percent,
                "label": best_match['label'] if best_match else None
            }
        }
        
    except Exception as e:
        print(f"❌ Error in CLIP verification: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            "success": False,
            "error": str(e),
            "satisfiesConditions": False
        }


def main():
    """Main function to handle requests from Node.js"""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        image_base64 = input_data.get('image')
        conditions = input_data.get('conditions', [])
        require_strict_match = input_data.get('requireStrictMatch', False)
        
        if not image_base64:
            result = {
                "success": False,
                "error": "No image provided",
                "satisfiesConditions": False
            }
        else:
            result = verify_image_with_clip(image_base64, conditions, require_strict_match)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "satisfiesConditions": False
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()

