# How to Verify Servers Are Running

## Quick Check Commands

### Option 1: Check in Browser
Open these URLs:

1. **Frontend:** http://localhost:8080
   - ✅ Should show your React app
   - ❌ Connection refused = Frontend not running

2. **API Server Health:** http://localhost:8001/health
   - ✅ Should return: `{"status":"ok","docext_connected":true,...}`
   - ❌ Connection refused = API server not running

### Option 2: Check Ports (Command Line)
```powershell
netstat -ano | findstr ":8080"
netstat -ano | findstr ":8001"
```

If you see "LISTENING" → Server is running ✅

## What You Should See

### Frontend Dev Server Terminal
```
  VITE vX.X.X  ready in XXX ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

### Docext API Server Terminal
```
Starting Docext API server on http://localhost:8001
Connecting to docext server at: http://localhost:7860
INFO:     Uvicorn running on http://0.0.0.0:8001
```

## If Servers Are NOT Running

### Start Frontend:
```bash
cd D:\dowl\beta_17\Beta-17-main
npm run dev
```

### Start API Server:
```bash
cd D:\dowl\photo_ver_model\docext-main
python docext_api_server.py
```

## Common Issues

### "ERR_CONNECTION_REFUSED"
- **Cause:** Server is not running
- **Fix:** Start the server (see commands above)

### API Server shows "Cannot connect to docext server"
- **Cause:** Gradio server (port 7860) not running
- **Fix:** Start Gradio server first: `python -m docext.app.app`

### Port already in use
- **Cause:** Another process using the port
- **Fix:** Stop other processes or change port in config

## Test Checklist

- [ ] Frontend accessible at http://localhost:8080
- [ ] API server accessible at http://localhost:8001/health
- [ ] Can navigate to /register-ngo page
- [ ] Upload Aadhaar photo works without errors

