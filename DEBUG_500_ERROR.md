# 🔍 Debugging 500 Error in extract-id

## Issue
Getting 500 Internal Server Error when calling `/api/extract-id`

## Enhanced Error Logging Added

I've added detailed logging to help identify the exact error:

### Backend Logs
The backend will now log:
- ✅ Request details (fileUrl, fileName, fileType)
- ✅ MongoDB download progress
- ✅ PDF.co API calls and responses
- ✅ Gemini API calls and responses
- ✅ Full error stack traces

### Frontend Logs
The frontend will now log:
- ✅ Request being sent to backend
- ✅ Full error response from backend
- ✅ Detailed error object in development mode

## How to Debug

### Step 1: Check Backend Console

When you upload a file, watch the backend terminal for:
```
📥 Received extract-id request: { fileUrl: '...', fileName: '...', fileType: '...' }
📥 Downloading file from MongoDB...
✅ File downloaded from MongoDB: X bytes
🔍 Step 1: Extracting text using PDF.co OCR...
```

**Look for error messages** - they will show exactly where it fails:
- ❌ MongoDB download error
- ❌ PDF.co OCR Error
- ❌ Gemini AI Error

### Step 2: Check Frontend Console

Open browser DevTools (F12) → Console tab

You'll see:
```
📤 Sending to extract-id: { fileUrl: '...', fileName: '...', fileType: '...' }
```

Then either:
- ✅ Success response
- ❌ Error with full details

### Step 3: Common Issues

#### Issue 1: File URL Format
**Error**: "Invalid MongoDB file URL format"
**Fix**: The fileUrl should be like `/api/file/67890abcdef1234567890123`

#### Issue 2: MongoDB Not Connected
**Error**: "MongoDB not connected"
**Fix**: Restart backend (already done ✅)

#### Issue 3: PDF.co API Error
**Error**: "PDF.co OCR failed"
**Possible causes**:
- Invalid API key
- API quota exceeded
- File format not supported

#### Issue 4: Gemini API Error
**Error**: "Gemini AI failed"
**Possible causes**:
- Invalid API key
- API quota exceeded
- Network issue

## Next Steps

1. **Try uploading a file again**
2. **Watch backend console** for detailed error messages
3. **Check frontend console** for error details
4. **Share the error message** you see in backend console

The enhanced logging will show exactly where the 500 error is coming from!

---

**🎯 Action: Try uploading again and share the backend console error message**
