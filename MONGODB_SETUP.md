# 🗄️ MongoDB Setup for File Storage

## Overview

Files are now stored in **MongoDB** using GridFS instead of Firebase Storage. This eliminates CORS issues and provides better control.

## Setup Instructions

### Option 1: Local MongoDB

1. **Install MongoDB**:
   - Windows: Download from https://www.mongodb.com/try/download/community
   - Or use Docker: `docker run -d -p 27017:27017 --name mongodb mongo:latest`

2. **Update `.env`**:
   ```env
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=community_donation_tracker
   ```

3. **Start MongoDB** (if not using Docker):
   ```bash
   # Windows
   mongod

   # Or if installed as service, it should be running
   ```

### Option 2: MongoDB Atlas (Cloud - Recommended for Production)

1. **Create Account**: https://www.mongodb.com/cloud/atlas

2. **Create Cluster** (Free tier available)

3. **Get Connection String**:
   - Click "Connect" → "Connect your application"
   - Copy connection string

4. **Update `.env`**:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
   MONGODB_DB_NAME=community_donation_tracker
   ```

## Verify MongoDB Connection

1. **Restart backend server**
2. **Check logs** - Should see:
   ```
   ✅ MongoDB connected successfully
   📦 Database: community_donation_tracker
   📁 GridFS Bucket: ngo_files
   ```

## How It Works

### File Upload Flow:
```
Frontend → Backend /api/upload-file → MongoDB GridFS → Returns fileId
Frontend → Backend /api/extract-id → Uses fileId URL → PDF.co → Gemini
```

### File Storage:
- Files stored in MongoDB GridFS bucket: `ngo_files`
- Each file gets unique ObjectId
- File URL format: `http://localhost:3000/api/file/{fileId}`

### File Retrieval:
- GET `/api/file/{fileId}` - Download/view file
- Files are streamed directly from MongoDB

## Environment Variables

Add to `backend/.env`:
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=community_donation_tracker
```

## Testing

1. **Upload a file** via the frontend
2. **Check MongoDB**:
   ```bash
   # Using MongoDB shell
   mongosh
   use community_donation_tracker
   db.ngo_files.files.find()
   ```

3. **Access file directly**:
   - `http://localhost:3000/api/file/{fileId}`

## Troubleshooting

### Error: "MongoDB not connected"
- Check `MONGODB_URI` in `.env`
- Verify MongoDB is running
- Check connection string format

### Error: "Connection refused"
- MongoDB not running
- Wrong port (default: 27017)
- Firewall blocking connection

### Error: "Authentication failed"
- Check username/password in connection string
- Verify MongoDB user has proper permissions

## Benefits of MongoDB Storage

✅ **No CORS issues** - Files served from your backend
✅ **Better control** - Full control over file access
✅ **Scalable** - MongoDB GridFS handles large files
✅ **Integrated** - Same database as your application data
✅ **No external dependencies** - No Firebase Storage needed

---

**After setting up MongoDB, restart the backend and test file upload!** 🚀

