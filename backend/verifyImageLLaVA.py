#!/usr/bin/env python3
"""
LLaVA-based Image Verification Service
Uses llava-hf/llava-1.5-7b-hf model for vision-language understanding
"""

import sys
import json
import base64
from io import BytesIO
from PIL import Image
from transformers import pipeline
import torch

# Initialize LLaVA pipeline once (singleton)
_llava_pipeline = None

def get_llava_pipeline():
    """Get or initialize LLaVA pipeline"""
    global _llava_pipeline
    if _llava_pipeline is None:
        try:
            print("🔄 Initializing LLaVA model...", file=sys.stderr)
            # Use pipeline for easier API
            _llava_pipeline = pipeline(
                "image-text-to-text",
                model="llava-hf/llava-1.5-7b-hf",
                device_map="auto" if torch.cuda.is_available() else "cpu",
                model_kwargs={"torch_dtype": torch.float16} if torch.cuda.is_available() else {}
            )
            print("✅ LLaVA model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"❌ Failed to load LLaVA model: {e}", file=sys.stderr)
            raise
    return _llava_pipeline

def verify_image_with_llava(image_base64, conditions, require_strict_match=False):
    """
    Verify image against conditions using LLaVA model
    
    Args:
        image_base64: Base64 encoded image string
        conditions: List of condition objects with 'title' and 'description'
        require_strict_match: Whether to require strict matching
    
    Returns:
        Dictionary with verification results
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        
        # Convert PIL Image to bytes for URL or use directly
        # For LLaVA, we'll use the image directly in the pipeline
        
        print(f"📷 Processing image: {image.size[0]}x{image.size[1]}", file=sys.stderr)
        print(f"📋 Checking {len(conditions)} condition(s)...", file=sys.stderr)
        
        # Get LLaVA pipeline
        pipe = get_llava_pipeline()
        
        # Build verification prompt based on conditions
        if len(conditions) == 0:
            verification_text = "Does this image show legitimate NGO work activities?"
        else:
            # Build condition-specific verification text
            condition_descriptions = []
            for idx, condition in enumerate(conditions, 1):
                title = condition.get('title', '').strip()
                description = condition.get('description', '').strip()
                
                if title and description:
                    condition_descriptions.append(f"{idx}. Claim: \"{title}\"\n   Description: {description}")
                elif title:
                    condition_descriptions.append(f"{idx}. Claim: \"{title}\"")
            
            conditions_text = "\n".join(condition_descriptions)
            
            # Build system prompt for NGO transparency audits
            strict_instruction = "Be EXTREMELY STRICT. Follow all rules strictly." if require_strict_match else "Follow the rules but be reasonable."
            
            # Build detailed condition list for prompt
            condition_list = ""
            for idx, cond_desc in enumerate(condition_descriptions, 1):
                condition_list += f"\n{idx}. {cond_desc}\n"
            
            verification_text = f"""You are a strict image verification AI for NGO transparency audits.

TASK: Check if this image ACTUALLY shows the work described in the NGO claims below.

CRITICAL RULES - BE EXTREMELY STRICT:

1. **VISUAL EVIDENCE REQUIRED**: The image MUST clearly show the specific activity described in the claim. Vague matches are NOT acceptable.

2. **CHECK EACH CLAIM INDIVIDUALLY**:
{condition_list}

3. **VERIFICATION LOGIC**:
   - If the image shows work related to ANY ONE claim above → VERIFIED (with that specific claim)
   - If the image shows partial/some evidence but not complete → PARTIALLY VERIFIED
   - If the image shows NOTHING related to the claims → NOT VERIFIED
   - If image is a screenshot, logo, poster, AI-generated, or unrelated → NOT VERIFIED

4. **CONFIDENCE SCORING**:
   - 90-100%: Clear, obvious match - you can clearly see the claim's activity in the image
   - 70-89%: Good match but some uncertainty
   - 50-69%: Partial match or unclear
   - 0-49%: No match or unrelated

5. **STRICT MATCHING**: For "feeding people" → image MUST show people being fed or food distribution. For "travel expense" → image MUST show vehicles, transport, or evacuation. Generic NGO work is NOT enough.

ANALYSIS STEPS:

STEP 1: Look at the image. What do you ACTUALLY see? Describe it exactly:
- What objects are in the image?
- What actions are happening?
- What is the environment/setting?
- Are there people? What are they doing?

STEP 2: For EACH claim above, check:
- Does the image show activities mentioned in that claim?
- Can you see visual evidence supporting that specific claim?
- Is there a DIRECT, OBVIOUS match?

STEP 3: Make decision:
- VERIFIED: Image clearly shows work from at least one claim above
- PARTIALLY VERIFIED: Image shows some but not complete evidence
- NOT VERIFIED: Image doesn't show any of the claimed work

RESPOND WITH THIS EXACT JSON FORMAT (no other text):

{{
  "verification": "VERIFIED" | "PARTIALLY VERIFIED" | "NOT VERIFIED",
  "reason": "One clear sentence explaining why (e.g., 'Image shows people distributing food in flood area' or 'Image does not show any feeding or travel activities')",
  "matchedCondition": "Exact condition title that matches, or null if none match",
  "confidence": 85,
  "whatIsInImage": "Brief exact description of what you see",
  "evidence": "Specific visual evidence that supports or contradicts the claim"
}}

Now analyze the image against the claims above and return ONLY the JSON response:"""
        
        print("🤖 Running LLaVA verification...", file=sys.stderr)
        
        # Use LLaVA pipeline for image-text understanding
        # The pipeline expects messages format with image and text
        # For local PIL Images, we can pass them directly in the content
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},  # Pass PIL Image directly
                    {"type": "text", "text": verification_text}
                ]
            }
        ]
        
        # Run inference using pipeline
        # The pipeline accepts messages with image objects (PIL Image)
        try:
            result = pipe(text=messages, max_new_tokens=256)
        except Exception as e:
            # If messages format fails, try alternative approach
            print(f"   ⚠️  Pipeline messages format failed: {e}", file=sys.stderr)
            print(f"   Trying alternative approach...", file=sys.stderr)
            # Alternative: Use image parameter directly if supported
            try:
                result = pipe(images=image, text=verification_text, max_new_tokens=256)
            except Exception as e2:
                print(f"   ❌ Alternative approach also failed: {e2}", file=sys.stderr)
                raise e
        
        # Extract response text
        response_text = ""
        if isinstance(result, list) and len(result) > 0:
            # Get the generated text from the result
            if isinstance(result[0], dict):
                response_text = result[0].get('generated_text', '') or result[0].get('text', '')
            elif isinstance(result[0], str):
                response_text = result[0]
        elif isinstance(result, str):
            response_text = result
        
        print(f"✅ LLaVA verification completed", file=sys.stderr)
        print(f"📝 Response: {response_text[:200]}...", file=sys.stderr)
        
        # Parse response - try to extract JSON if present
        verification_status = "NOT VERIFIED"
        reason = "Could not verify claim against image."
        matched_condition = None
        confidence = 50
        what_is_in_image = ""
        evidence = ""
        
        # Try to parse JSON from response
        try:
            # Look for JSON in response
            json_match = None
            if '{' in response_text and '}' in response_text:
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}') + 1
                json_text = response_text[start_idx:end_idx]
                try:
                    parsed = json.loads(json_text)
                    verification_status = parsed.get('verification', 'NOT VERIFIED')
                    reason = parsed.get('reason', reason)
                    matched_condition = parsed.get('matchedCondition')
                    confidence = parsed.get('confidence', 50)
                    what_is_in_image = parsed.get('whatIsInImage', '')
                    evidence = parsed.get('evidence', '')
                except json.JSONDecodeError:
                    pass
        except:
            pass
        
        # If JSON parsing failed, try to extract verification status from text
        if verification_status == "NOT VERIFIED":
            # Check for keywords in response - be conservative
            response_upper = response_text.upper()
            
            # Check for explicit verification status
            if '"VERIFIED"' in response_text or 'VERIFIED' in response_upper:
                # Only accept if confidence is high enough
                if "PARTIALLY VERIFIED" in response_upper:
                    verification_status = "PARTIALLY VERIFIED"
                    confidence = 60  # Default confidence for partial
                elif "VERIFIED" in response_upper:
                    # Extract confidence if mentioned
                    confidence_match = None
                    if '"confidence"' in response_text or 'confidence' in response_upper:
                        try:
                            import re
                            conf_match = re.search(r'"confidence"\s*:\s*(\d+)', response_text)
                            if conf_match:
                                confidence = int(conf_match.group(1))
                            else:
                                confidence = 75  # Default
                        except:
                            confidence = 75
                    else:
                        confidence = 75
                    verification_status = "VERIFIED"
                else:
                    verification_status = "NOT VERIFIED"
                    confidence = 30
            elif "NOT VERIFIED" in response_upper or "NO MATCH" in response_upper or "DOES NOT" in response_upper:
                verification_status = "NOT VERIFIED"
                confidence = 30
            else:
                # Default to NOT VERIFIED if unclear
                verification_status = "NOT VERIFIED"
                confidence = 30
        
        # If still no reason extracted, use response text
        if not reason or reason == "Could not verify claim against image.":
            reason = response_text.strip()[:500]  # Limit length
        
        # Determine satisfiesConditions based on verification status
        # Only "VERIFIED" satisfies conditions (not PARTIALLY VERIFIED)
        satisfies_conditions = verification_status == "VERIFIED"
        
        # Log verification status
        print(f"📊 Verification Status: {verification_status}", file=sys.stderr)
        if verification_status == "PARTIALLY VERIFIED":
            print(f"   ⚠️  Partial verification - some but not all conditions met", file=sys.stderr)
        
        # Find which condition was matched - more strict matching
        if matched_condition is None and (satisfies_conditions or verification_status == "PARTIALLY VERIFIED"):
            # Try to match from conditions list - check for exact or close matches
            response_lower = response_text.lower()
            best_match = None
            best_score = 0
            
            for condition in conditions:
                title = condition.get('title', '').strip().lower()
                description = condition.get('description', '').strip().lower()
                
                # Check if condition title appears in response
                if title and title in response_lower:
                    score = len(title)  # Longer matches are better
                    if score > best_score:
                        best_match = condition.get('title', '').strip()
                        best_score = score
                
                # Also check if description keywords appear
                if description:
                    desc_words = description.split()
                    matched_words = sum(1 for word in desc_words if word in response_lower)
                    if matched_words > 0:
                        score = matched_words * 5  # Weight description matches
                        if score > best_score:
                            best_match = condition.get('title', '').strip()
                            best_score = score
            
            if best_match:
                matched_condition = best_match
                print(f"   ✅ Matched condition: {matched_condition}", file=sys.stderr)
        
        # Build reasoning
        reasoning = f"LLaVA analysis: {reason}"
        if evidence:
            reasoning += f" Evidence: {evidence}"
        
        # Build condition analysis
        condition_analysis = []
        for condition in conditions:
            condition_title = condition.get('title', '').strip()
            if condition_title == matched_condition:
                if verification_status == "PARTIALLY VERIFIED":
                    condition_analysis.append(f"{condition_title}: PARTIALLY VERIFIED - {confidence}% confidence")
                else:
                    condition_analysis.append(f"{condition_title}: VERIFIED - {confidence}% confidence")
            else:
                condition_analysis.append(f"{condition_title}: NOT VERIFIED")
        
        # Final validation: Verify matched condition actually exists in our conditions list
        if matched_condition:
            condition_titles = [c.get('title', '').strip() for c in conditions]
            if matched_condition not in condition_titles:
                # Try fuzzy match
                matched_found = False
                for cond_title in condition_titles:
                    if matched_condition.lower() in cond_title.lower() or cond_title.lower() in matched_condition.lower():
                        matched_condition = cond_title
                        matched_found = True
                        print(f"   ✅ Fuzzy matched condition: {matched_condition}", file=sys.stderr)
                        break
                
                if not matched_found:
                    print(f"   ⚠️  Matched condition '{matched_condition}' not found in conditions list", file=sys.stderr)
                    # If condition doesn't match, be more strict
                    if verification_status == "VERIFIED":
                        verification_status = "NOT VERIFIED"
                        satisfies_conditions = False
                        confidence = max(0, confidence - 20)  # Lower confidence
                        matched_condition = None
                        print(f"   ❌ Rejecting: Matched condition not in list", file=sys.stderr)
        
        # Additional strict check: Require high confidence for VERIFIED
        if verification_status == "VERIFIED" and confidence < 70:
            print(f"   ⚠️  VERIFIED but confidence too low ({confidence}%), downgrading to PARTIALLY VERIFIED", file=sys.stderr)
            verification_status = "PARTIALLY VERIFIED"
            satisfies_conditions = False
        
        # Log final result
        print(f"📊 Final Result: {verification_status} (confidence: {confidence}%)", file=sys.stderr)
        if matched_condition:
            print(f"   ✅ Matched condition: {matched_condition}", file=sys.stderr)
        
        return {
            "success": True,
            "satisfiesConditions": satisfies_conditions,
            "verificationStatus": verification_status,  # VERIFIED, PARTIALLY VERIFIED, or NOT VERIFIED
            "conditionMatches": matched_condition if (satisfies_conditions or verification_status == "PARTIALLY VERIFIED") else None,
            "confidence": min(max(confidence, 0), 100),  # Clamp between 0-100
            "isAIGenerated": False,  # LLaVA doesn't detect AI generation, but we can add logic if needed
            "reasoning": reasoning,
            "details": {
                "whatIsInImage": what_is_in_image or "LLaVA analysis completed",
                "whyItMatchesOrNot": reason,
                "evidence": evidence,
                "conditionAnalysis": condition_analysis,
                "llavaResponse": response_text[:1000]  # Store first 1000 chars of response
            },
            "verificationMethod": "llava-1.5-7b-hf"
        }
        
    except Exception as e:
        print(f"❌ Error in LLaVA verification: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "satisfiesConditions": False,
            "confidence": 0
        }

if __name__ == "__main__":
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        image_base64 = input_data.get('image', '')
        conditions = input_data.get('conditions', [])
        require_strict_match = input_data.get('requireStrictMatch', False)
        
        if not image_base64:
            result = {
                "success": False,
                "error": "No image provided"
            }
        else:
            result = verify_image_with_llava(image_base64, conditions, require_strict_match)
        
        # Output JSON result
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "satisfiesConditions": False
        }
        print(json.dumps(error_result))
        sys.exit(1)

