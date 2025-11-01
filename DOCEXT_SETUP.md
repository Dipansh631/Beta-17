# Docext Setup Guide for Aadhaar Extraction

## Overview
Docext is integrated to extract structured information from Aadhaar card photos. This replaces the placeholder OCR with real AI-powered extraction.

## Setup Instructions

### Step 1: Install Docext

```bash
# Navigate to docext directory
cd D:\dowl\photo_ver_model\docext-main

# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate  # Linux/Mac

# Install docext
pip install docext

# Or install from source
pip install -e .
```

### Step 2: Start Docext Server

```bash
# Start the docext Gradio app (runs on port 7860)
python -m docext.app.app

# Or with custom options:
python -m docext.app.app --model_name "hosted_vllm/Qwen/Qwen2.5-VL-7B-Instruct-AWQ" --max_img_size 1024
```

**Important**: 
- First run will download the model (~5-10GB) - this may take time
- Server will be available at: http://localhost:7860
- Default credentials: `admin` / `admin`
- **Keep this terminal window open**

### Step 3: Start Docext API Server (Optional but Recommended)

The API server provides a cleaner REST interface:

```bash
# In docext directory
cd D:\dowl\photo_ver_model\docext-main

# Install FastAPI dependencies
pip install fastapi uvicorn gradio-client pandas pillow

# Start the API server (runs on port 8001)
python docext_api_server.py
```

**Note**: The API server requires the docext Gradio app to be running first.

### Step 4: Verify Setup

1. Check docext Gradio: http://localhost:7860 (should show login page)
2. Check API server: http://localhost:8001/health (should return status)

## Usage

### Automatic Extraction
When a user uploads an Aadhaar card photo:
1. Image is sent to docext API
2. Docext extracts: Name, DOB, Gender, Mobile, Address
3. Extracted data is displayed for user confirmation
4. User can edit any incorrect fields manually

### What Gets Extracted

- **Name**: Full name from Aadhaar card
- **DOB**: Date of Birth (DD/MM/YYYY format)
- **Gender**: Male/Female/Transgender
- **Mobile**: Mobile number (if visible)
- **Address**: Complete address with PIN code

## Troubleshooting

### "Unable to connect to Docext API"
- Ensure docext server is running: `python -m docext.app.app`
- Check if port 7860 is accessible
- Verify API server is running on port 8001 (if using API)

### Extraction returns empty fields
- Image quality may be too low - ensure clear, well-lit photo
- Aadhaar card may be partially covered or damaged
- Try different image format (JPG, PNG)
- Check docext server logs for errors

### Model download is slow
- First download can take 30+ minutes depending on internet
- Model size: ~5-10GB depending on variant
- Ensure stable internet connection

### GPU Requirements
- Recommended: NVIDIA GPU with 16GB+ VRAM
- CPU mode is supported but much slower
- For testing, Google Colab provides free GPU

### Port Conflicts
If port 7860 or 8001 is in use:
- Change docext port: `python -m docext.app.app --ui_port 7861`
- Change API port in `docext_api_server.py`: `uvicorn.run(app, port=8002)`
- Update `vite.config.ts` proxy target accordingly

## Alternative: Vendor-Hosted Models

For faster setup without local GPU:

```bash
# Set API key
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-...

# Run with hosted model
python -m docext.app.app --model_name "gpt-4o"
# or
python -m docext.app.app --model_name "claude-3-sonnet-20240229"
```

**Note**: Vendor-hosted models require internet and may have data privacy considerations.

## Architecture

```
User uploads Aadhaar photo
    ↓
Frontend (RegisterNGO.tsx)
    ↓
docextService.ts
    ↓
API Server (docext_api_server.py) on port 8001
    ↓
Docext Gradio App on port 7860
    ↓
AI Model (Qwen2.5-VL)
    ↓
Extracted fields returned
```

## Production Considerations

1. **Security**: Never expose docext server publicly without authentication
2. **Performance**: Use GPU for production, CPU only for testing
3. **Scaling**: Consider deploying on cloud with proper GPU instances
4. **Privacy**: For sensitive documents, use local models only
5. **Error Handling**: Always provide manual entry fallback

