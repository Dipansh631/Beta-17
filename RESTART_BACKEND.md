# ⚠️ Backend Needs Restart

The backend server needs to be **restarted** to apply the changes (ML models removed).

## Quick Fix

### Step 1: Stop Current Backend
Press `Ctrl+C` in the terminal where backend is running, OR:

```bash
# Kill process on port 3000
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Step 2: Restart Backend

**Option A: Restart Everything**
```bash
# Stop current npm run dev (Ctrl+C)
# Then restart:
npm run dev
```

**Option B: Restart Backend Only**
```bash
cd backend
npm run dev
```

## Verify Backend is Running

1. Check health: http://localhost:3000/health
2. Should return: `{"status":"ok","message":"NGO Registration API is running"}`

## Check Backend Logs

After restarting, watch the backend terminal. You should see:
- ✅ No Gemini/ML model errors
- ✅ Server running on port 3000
- ✅ When uploading ID: PDF.co upload logs

## If Still Getting 500 Error

1. **Check backend terminal logs** - Look for error messages
2. **Verify .env file** - Make sure `PDFCO_API_KEY` is set
3. **Check PDF.co API** - Verify API key is valid and has credits

---

**The backend code has been updated (ML models removed), but it needs to restart to take effect!**

