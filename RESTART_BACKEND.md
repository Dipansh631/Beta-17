# 🔄 Restart Backend to Fix MongoDB Connection

## Issue

MongoDB connection test works, but the running server didn't connect to MongoDB on startup.

## Solution

**You need to restart your backend server** so it can connect to MongoDB.

## Steps to Fix

### Option 1: Automatic Restart (If using `npm run dev`)

1. **Stop the backend** (press `Ctrl+C` in the backend terminal)
2. **Restart it**:
   ```bash
   cd backend
   npm run dev
   ```

### Option 2: Kill and Restart

1. **Kill the backend process**:
   ```powershell
   Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
   ```

2. **Start backend**:
   ```bash
   cd backend
   npm run dev
   ```

## Expected Output After Restart

You should see:
```
✅ Gemini AI initialized
✅ Gemini AI initialized for face verification
🔄 Connecting to MongoDB...
✅ MongoDB connected successfully
📦 Database: community_donation_tracker
📁 GridFS Bucket: ngo_files
✅ MongoDB ready for file storage
🚀 Server running on http://localhost:3000
```

## If MongoDB Still Fails

After restart, if you see:
```
⚠️ MongoDB connection failed: ...
```

Then:

1. **Check backend console** - look for the specific error message
2. **Verify connection string** in `backend/.env`
3. **Test connection manually**:
   ```bash
   cd backend
   node test-mongodb.js
   ```

## Quick Reconnect (New Feature)

If the server is running but MongoDB disconnected, you can try reconnecting via API:

```bash
curl -X POST http://localhost:3000/api/reconnect-mongodb
```

Or use the browser console:
```javascript
fetch('http://localhost:3000/api/reconnect-mongodb', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

---

**🎯 ACTION REQUIRED: Restart your backend server now!**
