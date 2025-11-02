# 🔧 MongoDB Connection Fix Guide

## Current Issue

Your MongoDB connection is **unstable** - it connects briefly but then fails. This causes:
- ❌ 503 errors on file uploads
- ❌ "MongoDB not connected" errors
- ❌ File uploads failing

## What I Fixed

1. ✅ **Health endpoint** - Now checks actual MongoDB connection status (not cached)
2. ✅ **TLS handling** - Only enables TLS for Atlas connections automatically
3. ✅ **Auto-reconnection** - Upload route now tries to reconnect once before failing
4. ✅ **Better error messages** - More detailed connection errors

## Root Cause

The MongoDB connection is **failing to connect** or **dropping**. Common causes:

1. **IP Whitelist** - Your IP not in MongoDB Atlas Network Access
2. **Wrong Connection String** - Connection string missing or incorrect
3. **Wrong Password** - Password in connection string doesn't match MongoDB Atlas
4. **Network Issues** - Firewall or network blocking MongoDB connections

## Quick Fix Steps

### Step 1: Verify MongoDB Connection String

Check your `backend/.env` file has the correct connection string:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=community_donation_tracker
```

**Replace**:
- `USERNAME` - Your MongoDB Atlas username
- `PASSWORD` - Your MongoDB Atlas password (URL-encoded if it contains special characters)

### Step 2: Fix MongoDB Atlas IP Whitelist

1. Go to: https://cloud.mongodb.com
2. Click **"Network Access"** in left sidebar
3. Click **"Add IP Address"**
4. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
5. Click **"Confirm"**
6. **Wait 1-2 minutes** for changes to propagate

### Step 3: Restart Backend

```bash
cd backend
# Stop current server (Ctrl+C)
npm run dev
```

**Look for these messages**:
```
🔄 Connecting to MongoDB...
✅ MongoDB connected successfully
📦 Database: community_donation_tracker
📁 GridFS Bucket: ngo_files
✅ MongoDB ready for file storage
```

### Step 4: Verify Connection

Test the health endpoint:
```powershell
Invoke-WebRequest -Uri http://localhost:3000/health | Select-Object -ExpandProperty Content
```

**Expected**:
```json
{"status":"ok","message":"NGO Registration API is running","mongodb":"connected"}
```

If it says `"mongodb":"disconnected"`, check backend console for errors.

## Test Connection

### Option 1: Use Debug Endpoint
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/debug/gridfs | Select-Object -ExpandProperty Content
```

**If connected**:
```json
{"success":true,"totalFiles":0,"files":[]}
```

**If not connected**:
```json
{"success":false,"message":"MongoDB not connected"}
```

### Option 2: Manual Reconnection
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/reconnect-mongodb -Method POST | Select-Object -ExpandProperty Content
```

**Expected**:
```json
{"success":true,"message":"MongoDB reconnected successfully"}
```

## Common Connection String Formats

### MongoDB Atlas (Cloud)
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/?retryWrites=true&w=majority
```

### Local MongoDB
```env
MONGODB_URI=mongodb://localhost:27017
```

## Troubleshooting

### Error: "MongoDB connection error: IP not whitelisted"
**Fix**: Add your IP to MongoDB Atlas Network Access

### Error: "MongoDB connection error: Authentication failed"
**Fix**: Check username and password in connection string

### Error: "MongoDB connection error: Connection timeout"
**Fix**: 
- Check MongoDB Atlas cluster is running (not paused)
- Check firewall isn't blocking connections
- Verify connection string is correct

### Error: "MongoDB connection error: TLS/SSL"
**Fix**: This is automatic now - TLS only enabled for Atlas connections

## Backend Logs to Check

When backend starts, check for:

✅ **Good**:
```
🔄 Connecting to MongoDB...
✅ MongoDB connected successfully
📦 Database: community_donation_tracker
```

❌ **Bad**:
```
❌ MongoDB connection error: ...
⚠️ MongoDB connection attempt 1/3 failed: ...
```

## After Fixing

Once MongoDB is connected:

1. ✅ Health endpoint shows `"mongodb":"connected"`
2. ✅ File uploads work without 503 errors
3. ✅ No "MongoDB not connected" errors in frontend
4. ✅ Backend logs show successful connection

## Still Having Issues?

1. **Check backend console** - Look for specific MongoDB error messages
2. **Verify connection string** - Make sure it's correct in `.env`
3. **Test MongoDB Atlas** - Make sure cluster is running and not paused
4. **Check Network Access** - Ensure IP whitelist includes `0.0.0.0/0` or your IP
5. **Restart backend** - Sometimes connection needs a fresh start

---

**Note**: If you have a MongoDB password like `rkFKLJ08BcWB2unj9Nix7SpGUxX2`, make sure it's correctly URL-encoded in the connection string (especially if it contains special characters).

