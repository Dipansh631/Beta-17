# Error Analysis: MongoDB Connection and Backend Issues

## Error Summary

You're experiencing a **chain of related errors** all stemming from **MongoDB not being connected**:

1. ✅ **503 Service Unavailable** - Backend is running, but MongoDB is disconnected
2. ✅ **MongoDB upload error: AxiosError** - Frontend catching the 503 response
3. ✅ **ID extraction error: MongoDB not connected** - Error message from failed upload
4. ✅ **Backend connection failed** - Warning message (backend may or may not be accessible)

## Root Cause Chain

```
MongoDB Not Connected
    ↓
Backend returns 503 when upload attempted
    ↓
Frontend catches 503 error (AxiosError)
    ↓
Error propagates: "MongoDB not connected"
```

## Detailed Error Breakdown

### 1. 503 Service Unavailable Error

**Location**: `backend/routes/uploadFile.js:204`

**What happens**:
```javascript
const mongoDB = getMongoDB();
if (!mongoDB || !mongoDB.gridFSBucket) {
  return res.status(503).json({
    success: false,
    message: 'MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist.',
    error: 'MongoDB connection failed. File upload unavailable.',
  });
}
```

**Why**: The backend checks MongoDB connection before allowing file uploads. If MongoDB is not connected, it returns HTTP 503 (Service Unavailable).

### 2. MongoDB Upload Error (AxiosError)

**Location**: `src/pages/RegisterNGO.tsx:177-189`

**What happens**:
```typescript
catch (uploadError: any) {
  console.error('❌ MongoDB upload error:', uploadError);
  throw new Error(
    uploadError.response?.data?.message || 
    uploadError.message || 
    "Failed to upload file to MongoDB"
  );
}
```

**Why**: When the backend returns 503, axios throws an error. The frontend catches it and throws a new error with the message "MongoDB not connected".

### 3. ID Extraction Error

**Location**: `src/pages/RegisterNGO.tsx:184`

**Error Message**: `"MongoDB not connected. Please check MongoDB connection and Atlas IP whitelist."`

**Why**: This is the error message extracted from the 503 response and thrown when the upload fails.

### 4. Backend Connection Failed Warning

**Location**: `src/pages/RegisterNGO.tsx:261`

**Message**: `"Backend connection failed. Make sure the backend server is running on port 3000."`

**Why**: This appears when axios cannot connect to the backend (ECONNREFUSED, Network Error, etc.). However, in your case, this might be a **misleading error** because:
- Port 3000 is open (verified)
- The actual issue is MongoDB, not the backend server

## Current Status

✅ **Backend Server**: Running on port 3000  
❌ **MongoDB Connection**: Not connected  
❌ **File Uploads**: Failing (503 error)  
❌ **ID Extraction**: Failing (depends on file upload)

## Solutions

### Solution 1: Fix MongoDB Atlas IP Whitelist (Most Likely Issue)

**Problem**: Your IP address is not whitelisted in MongoDB Atlas.

**Fix Steps**:

1. **Go to MongoDB Atlas**: https://cloud.mongodb.com
2. **Network Access**:
   - Click "Network Access" in left sidebar
   - Click "Add IP Address"
   - Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - Click "Confirm"
3. **Wait 1-2 minutes** for changes to propagate
4. **Restart backend**:
   ```bash
   cd backend
   npm run dev
   ```

**Expected Output**:
```
🔄 Connecting to MongoDB...
✅ MongoDB connected successfully
📦 Database: community_donation_tracker
📁 GridFS Bucket: ngo_files
✅ MongoDB ready for file storage
🚀 Server running on http://localhost:3000
```

### Solution 2: Check MongoDB Connection String

**Check**: `backend/.env` file

**Required**:
```env
MONGODB_URI=mongodb+srv://shubhverma099_db_user:jAKlJ428cSg3pyPq@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=community_donation_tracker
```

**Verify**:
- Connection string is correct
- Username and password are correct
- Database name matches

### Solution 3: Verify Backend is Running

**Check backend health**:
```powershell
# Check if backend is running
Invoke-WebRequest -Uri http://localhost:3000/health

# Should return:
# {"status":"ok","message":"NGO Registration API is running","mongodb":"disconnected"}
```

**If backend not running**:
```bash
cd backend
npm run dev
```

### Solution 4: Manual MongoDB Reconnection

**Reconnect endpoint**:
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/reconnect-mongodb -Method POST

# Should return:
# {"success":true,"message":"MongoDB reconnected successfully"}
```

**Check MongoDB status**:
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/debug/gridfs

# Shows MongoDB connection status and recent files
```

## Error Flow Diagram

```
User uploads file
    ↓
Frontend: POST /api/upload-file
    ↓
Backend: Check MongoDB connection
    ↓
MongoDB not connected?
    ↓ YES
Return 503: "MongoDB not connected"
    ↓
Frontend: Catch AxiosError
    ↓
Throw: "MongoDB not connected. Please check..."
    ↓
Show error to user
```

## Verification Steps

### Step 1: Check Backend Status
```powershell
Invoke-WebRequest -Uri http://localhost:3000/health
```
**Expected**: `{"status":"ok","mongodb":"connected"}`

### Step 2: Check MongoDB Connection
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/debug/gridfs
```
**Expected**: `{"success":true,...}`

### Step 3: Test File Upload
1. Open frontend: http://localhost:8080
2. Navigate to `/register-ngo`
3. Upload an ID file
4. Should work without errors

## Common Issues

### Issue 1: "MongoDB not connected" persists after IP whitelist fix

**Possible causes**:
- Changes not propagated (wait 2-3 minutes)
- Wrong connection string
- Incorrect credentials
- MongoDB Atlas cluster is paused

**Fix**: Restart backend after fixing IP whitelist

### Issue 2: "Backend connection failed" but backend is running

**Possible causes**:
- CORS issues
- Firewall blocking connections
- Wrong port (frontend connecting to wrong port)

**Fix**: Check `vite.config.ts` proxy settings and backend CORS config

### Issue 3: Backend starts but MongoDB doesn't connect

**Check backend logs** for:
- Connection timeout errors
- SSL/TLS errors
- Authentication errors

**Fix**: Check MongoDB Atlas:
- Cluster is running (not paused)
- IP whitelist includes your IP
- Database user exists with correct permissions

## Quick Fix Checklist

- [ ] Backend server is running (`cd backend && npm run dev`)
- [ ] MongoDB Atlas IP whitelist includes `0.0.0.0/0` (or your IP)
- [ ] MongoDB Atlas cluster is running (not paused)
- [ ] `.env` file has correct `MONGODB_URI`
- [ ] Backend logs show "✅ MongoDB connected successfully"
- [ ] Test health endpoint: `http://localhost:3000/health`
- [ ] Test upload endpoint: Upload a file from frontend

## Success Indicators

When everything is working, you should see:

**Backend Console**:
```
✅ MongoDB connected successfully
📦 Database: community_donation_tracker
📁 GridFS Bucket: ngo_files
✅ MongoDB ready for file storage
🚀 Server running on http://localhost:3000
```

**Frontend Console** (on file upload):
```
✅ File uploaded to MongoDB successfully
📄 File URL: /api/file/...
🆔 File ID: ...
```

**No errors in browser console!**

---

## Summary

**Main Issue**: MongoDB is not connected to the backend.

**Root Cause**: MongoDB Atlas IP whitelist doesn't include your IP address.

**Solution**: Add your IP (or `0.0.0.0/0`) to MongoDB Atlas Network Access, wait 2 minutes, restart backend.

**Verification**: Check `http://localhost:3000/health` - should show `"mongodb":"connected"`.

