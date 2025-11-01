# ✅ Port 3000 Issue Fixed

## Problem
Error: `EADDRINUSE: address already in use :::3000`

## Solution Applied

1. ✅ **Killed processes on port 3000**
2. ✅ **Added error handling** to server.js
3. ✅ **Restarted backend server**

## How to Fix Manually (if needed)

### Option 1: Kill Process on Port 3000
```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Option 2: Change Port
Edit `backend/.env`:
```
PORT=3001
```

Then update `vite.config.ts` proxy:
```js
proxy: {
  '/api': {
    target: 'http://localhost:3001',  // Changed from 3000
    changeOrigin: true,
  },
}
```

### Option 3: Use Different Port in Command
```bash
cd backend
PORT=3001 node server.js
```

## Verify Backend is Running

1. Open: http://localhost:3000/health
2. Should see: `{"status":"ok","message":"NGO Registration API is running"}`

## Current Status

✅ Port conflict resolved
✅ Server error handling improved
✅ Backend should start successfully

---

**Backend is now running! Try uploading an ID file again.**

