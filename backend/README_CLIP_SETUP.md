# CLIP Image Verification Setup

This backend now uses OpenAI's CLIP model (via Hugging Face) for more accurate image verification.

## Installation

1. **Install Python dependencies:**
   ```bash
   cd backend
   pip install -r requirements_verification.txt
   ```

   Or install manually:
   ```bash
   pip install torch transformers pillow sentencepiece protobuf
   ```

2. **Verify Python installation:**
   ```bash
   python --version  # Should be Python 3.7+
   python -c "import transformers; print('Transformers installed')"
   ```

3. **Test CLIP service:**
   ```bash
   python verifyImageCLIP.py
   ```
   (It will wait for JSON input via stdin)

## How It Works

1. **Primary**: CLIP model (Python) - More accurate for condition matching
2. **Secondary**: Gemini API - Used for AI generation detection (if GEMINI_API_KEY is set)
3. **Fallback**: If CLIP fails, falls back to Gemini for full verification

## CLIP Model Details

- **Model**: `openai/clip-vit-base-patch32`
- **Purpose**: Zero-shot image classification
- **Accuracy**: Better at matching images to specific condition descriptions
- **Threshold**: 70% confidence minimum (90% required for approval)

## Usage

The service automatically uses CLIP when available. No code changes needed - just install the Python dependencies.

## Troubleshooting

1. **"python3 not found"** (Windows):
   - Use `python` instead of `python3`
   - The code auto-detects this

2. **"ModuleNotFoundError: No module named 'transformers'"**:
   - Install dependencies: `pip install -r requirements_verification.txt`

3. **"CUDA out of memory"**:
   - CLIP will automatically use CPU if GPU is unavailable
   - Large images may take longer on CPU

4. **CLIP fails, falls back to Gemini**:
   - Check Python installation
   - Verify transformers library is installed
   - Check console logs for Python errors

## Performance

- **First run**: ~10-15 seconds (model download and initialization)
- **Subsequent runs**: ~2-5 seconds per image
- **GPU**: Faster if available
- **CPU**: Still works, just slower

