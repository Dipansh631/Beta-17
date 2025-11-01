# Quick Start Guide for CLIP Backend

## Problem
If you see "Unable to fetch details of photo" or validation not working, the CLIP backend API is not running.

## Solution: Start the CLIP API Server

### Step 1: Navigate to CLIP directory
```bash
cd D:\dowl\conditional_answer\CLIP-main
```

### Step 2: Install dependencies (if not already installed)
```bash
pip install fastapi uvicorn pillow python-multipart requests torch torchvision
pip install -e .
```

### Step 3: Start the API server
```bash
python clip_api_server.py
```

You should see:
```
Loading CLIP model on cpu...  (or cuda if GPU available)
CLIP model loaded successfully!
Starting CLIP API server on http://localhost:8000
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 4: Verify it's working
Open browser and go to: http://localhost:8000/health

You should see:
```json
{"status":"ok","model_loaded":true,"device":"cpu"}
```

### Step 5: Keep the server running
**IMPORTANT**: Keep this terminal window open. The server must be running for photo validation to work.

## Troubleshooting

### Port 8000 already in use?
Change the port in `clip_api_server.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)  # Use port 8001
```

Then update `vite.config.ts`:
```typescript
proxy: {
  '/api/clip': {
    target: 'http://localhost:8001',  // Match the new port
    ...
  }
}
```

### Model download is slow?
The first time you run it, CLIP will download the model (~500MB). This may take several minutes depending on your internet speed.

### GPU not detected?
The model will work on CPU, just slower. To use GPU, ensure you have:
- CUDA installed
- PyTorch with CUDA support: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118`

### Still having issues?
1. Check console for errors
2. Verify the server is accessible: http://localhost:8000/health
3. Check browser DevTools Network tab for failed requests
4. Make sure both servers are running:
   - Frontend: `http://localhost:8080` (Vite dev server)
   - Backend: `http://localhost:8000` (CLIP API)

## What happens without the backend?
The app will use simulated matching (not real CLIP). You'll see lower quality validation results.

