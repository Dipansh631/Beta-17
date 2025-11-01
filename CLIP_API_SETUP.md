# CLIP API Backend Setup

This guide shows how to set up a Python Flask/FastAPI backend to run CLIP model for image-text matching.

## Option 1: FastAPI Backend (Recommended)

### 1. Install Dependencies

```bash
cd D:\dowl\conditional_answer\CLIP-main
pip install fastapi uvicorn pillow python-multipart
pip install -e .
```

### 2. Create API Server

Create a file `clip_api_server.py` in the CLIP-main directory:

```python
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import clip
from PIL import Image
import io
import base64
from typing import List

app = FastAPI()

# Enable CORS for React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load CLIP model (do this once at startup)
device = "cuda" if torch.cuda.is_available() else "cpu"
model = None
preprocess = None

@app.on_event("startup")
async def load_model():
    global model, preprocess
    print(f"Loading CLIP model on {device}...")
    model, preprocess = clip.load("ViT-B/32", device=device)
    print("CLIP model loaded successfully!")

@app.post("/api/clip/match")
async def match_image_texts(request: dict):
    """
    Match an image against multiple text descriptions
    Expected input:
    {
        "image": "data:image/jpeg;base64,..." or URL,
        "texts": ["text1", "text2", ...]
    }
    """
    try:
        image_data = request.get("image")
        texts = request.get("texts", [])
        
        if not image_data or not texts:
            raise HTTPException(status_code=400, detail="Missing image or texts")
        
        # Decode base64 image if needed
        if image_data.startswith("data:image"):
            header, encoded = image_data.split(",", 1)
            image_bytes = base64.b64decode(encoded)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        else:
            # If URL, fetch it
            import requests
            response = requests.get(image_data)
            image = Image.open(io.BytesIO(response.content)).convert("RGB")
        
        # Preprocess image
        image_input = preprocess(image).unsqueeze(0).to(device)
        
        # Tokenize texts
        text_inputs = clip.tokenize(texts).to(device)
        
        # Calculate similarity
        with torch.no_grad():
            image_features = model.encode_image(image_input)
            text_features = model.encode_text(text_inputs)
            
            # Normalize features
            image_features /= image_features.norm(dim=-1, keepdim=True)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            
            # Calculate cosine similarity
            similarity = (100.0 * image_features @ text_features.T).softmax(dim=-1)
        
        # Convert to list of results
        matches = []
        for i, text in enumerate(texts):
            matches.append({
                "text": text,
                "score": float(similarity[0][i].item()),
                "matches": float(similarity[0][i].item()) >= 0.3
            })
        
        return {"matches": matches}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 3. Run the Server

```bash
python clip_api_server.py
```

The API will be available at `http://localhost:8000`

### 4. Update Frontend Service

The `clipService.ts` already tries to call `/api/clip/match`. To use a different port, update the fetch URL in `src/services/clipService.ts`.

## Option 2: Use Vite Proxy (Simpler)

Add this to `vite.config.ts`:

```typescript
server: {
  host: "::",
  port: 8080,
  hmr: {
    overlay: true,
  },
  proxy: {
    '/api/clip': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
},
```

Then the frontend can call `/api/clip/match` and Vite will proxy to the Python backend.

## Option 3: Cloud Function / Serverless

For production, deploy the CLIP API as a cloud function (AWS Lambda, Google Cloud Functions, etc.) and update the URL in `clipService.ts`.

## Testing

Test the API:

```bash
curl -X POST http://localhost:8000/api/clip/match \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "texts": ["education", "food distribution", "medical aid"]
  }'
```

## Notes

- First run will download the CLIP model (~500MB)
- Model loading takes ~10-30 seconds
- GPU recommended for faster inference
- The current implementation uses simulated matching if API is unavailable

