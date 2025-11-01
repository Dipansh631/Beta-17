# All Servers Status Guide

## Required Servers for Full Functionality

### 1. Frontend Dev Server (Required)
- **Port:** 8080
- **Command:** `cd D:\dowl\beta_17\Beta-17-main && npm run dev`
- **Status Check:** http://localhost:8080
- **Purpose:** Your React application

### 2. Docext API Server (Required for Aadhaar Extraction)
- **Port:** 8001
- **Command:** `cd D:\dowl\photo_ver_model\docext-main && python docext_api_server.py`
- **Status Check:** http://localhost:8001/health
- **Purpose:** Connects frontend to docext AI model
- **Depends on:** Gradio server (port 7860)

### 3. Docext Gradio Server (Required for Aadhaar Extraction)
- **Port:** 7860
- **Command:** `cd D:\dowl\photo_ver_model\docext-main && python -m docext.app.app`
- **Status Check:** http://localhost:7860
- **Purpose:** Provides AI model for document extraction
- **Note:** First run downloads model (~5-10GB)

### 4. CLIP API Server (Required for Logo Validation)
- **Port:** 8000
- **Command:** `cd D:\dowl\conditional_answer\CLIP-main && python clip_api_server.py`
- **Status Check:** http://localhost:8000/health
- **Purpose:** Image-to-text matching for logo validation

## Quick Start Order

1. **Start Gradio Server** (if using Aadhaar extraction)
2. **Start Docext API Server** (depends on Gradio)
3. **Start CLIP API Server** (if using logo validation)
4. **Start Frontend Dev Server**

## Status Check URLs

- Frontend: http://localhost:8080
- Docext API: http://localhost:8001/health
- Gradio: http://localhost:7860
- CLIP API: http://localhost:8000/health

## Error Messages

- **"Failed to fetch"** → API server (8001) not running
- **"Cannot connect to docext server"** → Gradio server (7860) not running
- **"CLIP API not available"** → CLIP server (8000) not running

