# How to Start All Servers

## Quick Start Guide

You need to start **3 servers** in this order:

### Step 1: Start Docext Gradio Server (Terminal 1)
```bash
cd D:\dowl\photo_ver_model\docext-main
python -m docext.app.app
```

**Wait for:**
- "Running on local URL: http://localhost:7860"
- First run will download model (~5-10GB, takes 10-30 minutes)

**Keep this terminal open!**

### Step 2: Start Docext API Server (Terminal 2)
```bash
cd D:\dowl\photo_ver_model\docext-main
python docext_api_server.py
```

**Wait for:**
- "Starting Docext API server on http://localhost:8001"
- "Connected to docext server at http://localhost:7860"

**Keep this terminal open!**

### Step 3: Start Frontend Dev Server (Terminal 3)
```bash
cd D:\dowl\beta_17\Beta-17-main
npm run dev
```

**Wait for:**
- "Local: http://localhost:8080/"

**Keep this terminal open!**

## Verify All Servers Are Running

### Check Ports:
1. **Frontend**: http://localhost:8080 → Should show your app
2. **API Server**: http://localhost:8001/health → Should return JSON status
3. **Gradio Server**: http://localhost:7860 → Should show docext interface

### Quick Test:
- Open http://localhost:8080/register-ngo
- Upload an Aadhaar card photo
- If extraction works → ✅ All servers running!
- If error → Check which server isn't running

## Common Issues

### "ERR_CONNECTION_REFUSED" on port 8080
- **Fix**: Start frontend dev server: `npm run dev`

### "Unable to connect to Docext API"
- **Fix**: Start both docext servers (Gradio first, then API)

### "Cannot connect to docext server at http://localhost:7860"
- **Fix**: Start Gradio server first: `python -m docext.app.app`

### Port Already in Use
- Stop the process using the port or change ports in config files

## Using Batch Files (Windows)

Double-click these files in order:
1. `start_gradio_server.bat` (in docext-main folder)
2. `start_api_server.bat` (in docext-main folder)
3. Run `npm run dev` (in Beta-17-main folder)

## All Servers Must Run Together

- **Gradio** (7860) → Provides AI model
- **API** (8001) → Connects Gradio to frontend
- **Frontend** (8080) → Your React app

If any server stops, restart it!

