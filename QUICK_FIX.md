# Quick Fix for "Failed to fetch" Error

## The Problem
When uploading Aadhaar photo, you see: "Failed to fetch" or "Cannot connect to Docext API"

## The Solution - Start 2 Servers

### Step 1: Start Docext API Server

**Open a NEW terminal/command prompt and run:**
```bash
cd D:\dowl\photo_ver_model\docext-main
python docext_api_server.py
```

**Wait for:** "Starting Docext API server on http://localhost:8001"
**Keep this terminal open!**

### Step 2: Verify API Server is Running

**Open in browser:** http://localhost:8001/health

**Should see:** `{"status":"ok","docext_connected":true,...}`

### Step 3: Start Frontend Dev Server (if not running)

**Open another terminal and run:**
```bash
cd D:\dowl\beta_17\Beta-17-main
npm run dev
```

**Wait for:** "Local: http://localhost:8080/"

### Step 4: Test Again

1. Go to http://localhost:8080/register-ngo
2. Upload Aadhaar card photo
3. Should work now!

## Quick Check Script

**Double-click this file:** `D:\dowl\photo_ver_model\docext-main\check_and_start.bat`

It will check and start servers automatically.

## If Still Not Working

1. **Check if ports are in use:**
   - Port 8001 (API server)
   - Port 7860 (Gradio server - optional if API connects)
   - Port 8080 (Frontend)

2. **Verify servers are accessible:**
   - http://localhost:8001/health ← Should return JSON
   - http://localhost:8080 ← Should show your app

3. **Check terminal output** for errors

4. **Restart servers** - Close terminals and start again

## Manual Entry Option

While servers are starting, you can **enter Aadhaar details manually** in the form. The extraction is optional!

