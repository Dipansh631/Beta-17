# Starting the Backend Server

The backend server needs to be running for the NGO registration to work.

## Quick Start

### Option 1: Start Backend Only
```bash
cd backend
npm run dev
```

### Option 2: Start Both Frontend and Backend
```bash
# From project root
npm run dev
```

## Verify Backend is Running

Open: http://localhost:3000/health

Should return: `{"status":"ok","message":"NGO Registration API is running"}`

## Common Issues

### Port 3000 already in use
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Backend won't start
1. Check if `backend/.env` exists
2. Verify API keys are set
3. Check `backend/node_modules` exists (run `npm install`)

### Network Error in Frontend
- Make sure backend is running on port 3000
- Check browser console for errors
- Verify `API_BASE_URL` in RegisterNGO.tsx points to `http://localhost:3000`

## Backend Logs

When backend starts, you should see:
```
🚀 Server running on http://localhost:3000
📋 Health check: http://localhost:3000/health
🔐 Make sure to set PDFCO_API_KEY and GEMINI_API_KEY in .env
```

