# 🚀 Running the Project on Localhost

## Quick Start

### Option 1: Run Both Servers Together (Recommended)
```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:8080 (or 8081 if 8080 is busy)
- **Backend**: http://localhost:3000

### Option 2: Run Servers Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

## Verify Everything is Running

### 1. Backend Health Check
Open: http://localhost:3000/health

Should return:
```json
{"status":"ok","message":"NGO Registration API is running"}
```

### 2. Frontend
Open: http://localhost:8080

Or if port 8080 is in use: http://localhost:8081

### 3. Test the App
1. Open the frontend URL in your browser
2. Navigate to `/register-ngo`
3. Try uploading an ID file

## Port Configuration

- **Frontend**: 8080 (or 8081 if 8080 is busy)
- **Backend**: 3000

If ports are in use:
- **Change Frontend Port**: Edit `vite.config.ts` → `port: 8080`
- **Change Backend Port**: Edit `backend/.env` → `PORT=3000`

## Troubleshooting

### Port Already in Use
```powershell
# Kill process on port 3000 (Backend)
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Kill process on port 8080 (Frontend)
Get-NetTCPConnection -LocalPort 8080 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Backend Not Starting
1. Check if `backend/.env` exists
2. Verify `PDFCO_API_KEY` is set
3. Check backend terminal for errors

### Frontend Not Starting
1. Check if `node_modules` is installed: `npm install`
2. Check frontend terminal for errors

## URLs

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **ID Extraction**: http://localhost:3000/api/extract-id
- **Face Verification**: http://localhost:3000/api/verify-face
- **Register NGO**: http://localhost:3000/api/register-ngo

---

**✅ Your project should now be running on localhost!**

