# Fixing 500 Internal Server Error - Step by Step

## ✅ What I've Fixed

1. **Improved error handling** - Better error messages and logging
2. **Added try-catch blocks** - Around PDF.co upload, OCR, and Gemini API calls
3. **Enhanced logging** - More detailed console output for debugging
4. **Better error responses** - More informative error messages to frontend

## 🔄 Restart Backend to Apply Changes

**Important:** The backend needs to be restarted to load the updated code!

### Option 1: Stop and Restart
1. Stop the current backend (Ctrl+C in the terminal running it)
2. Start it again:
   ```bash
   cd backend
   npm run dev
   ```

### Option 2: Kill Process and Restart
```bash
# Kill all node processes (careful - this kills ALL node processes)
taskkill /F /IM node.exe

# Then restart backend
cd backend
npm run dev
```

## 🔍 Check Backend Logs

After restarting, when you upload an ID file, you should see detailed logs:

```
📤 Uploading file to PDF.co...
PDF.co Upload Response Status: 200
✅ File uploaded to PDF.co: https://...
🔍 Extracting text using PDF.co OCR...
Using PDF.co OCR for image...
OCR Response Status: 200
OCR Response: {...}
✅ Text extracted from document
🤖 Using Gemini to structure ID data...
Gemini Response: {...}
✅ ID extraction successful
```

If there's an error, you'll see:
```
❌ Error in extractId: ...
Error Details: {...}
```

## 🐛 Common Issues

### Issue: "PDF.co upload failed"
- Check API key is correct in `backend/.env`
- Verify PDF.co account has credits
- Check file size (should be < 10MB)

### Issue: "PDF.co OCR failed"
- The OCR endpoint might need adjustment
- Check if file URL is accessible
- Verify API key has OCR permissions

### Issue: "Gemini AI failed"
- Check GEMINI_API_KEY is correct
- Verify API key has quota/credits
- Check internet connection

## 📋 Next Steps

1. **Restart backend** (see above)
2. **Try uploading an ID file again**
3. **Check backend terminal logs** for detailed error messages
4. **Share the error message** from backend logs if it still fails

---

**The backend now has much better error reporting. Check the terminal where backend is running for detailed error information!**

