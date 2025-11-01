# Debugging 500 Internal Server Error

## Steps to Debug

### 1. Check Backend Console Logs

The backend server should show detailed error logs. Look for:
- `❌ Error in extractId:`
- `PDF.co Upload Error:`
- `PDF.co OCR Error:`

### 2. Common Causes

#### A. PDF.co API Key Issue
- Check if API key is correct in `backend/.env`
- Verify API key format: `email_apiKey`
- Check PDF.co account has credits

#### B. PDF.co API Endpoint Issue
- The OCR endpoint might be different
- Try testing the API key directly

#### C. File Upload Issue
- Check file size (should be < 10MB)
- Check file format (JPG, PNG, PDF)
- Verify multer is handling the file correctly

### 3. Test PDF.co API Directly

You can test if PDF.co API is working:

```bash
# Test with curl (replace with your actual file and key)
curl -X POST "https://api.pdf.co/v1/file/upload" \
  -H "x-api-key: YOUR_API_KEY" \
  -F "file=@test-image.jpg"
```

### 4. Check Backend Logs

After uploading a file, check the backend terminal for:
```
📤 Uploading file to PDF.co...
PDF.co Upload Response Status: 200
✅ File uploaded to PDF.co: https://...
🔍 Extracting text using PDF.co OCR...
```

If you see errors here, that's where the issue is.

### 5. Restart Backend with Verbose Logging

The backend now has improved error logging. Look for:
- Detailed error messages
- API response data
- Stack traces (in development mode)

---

**Next Steps:**
1. Check backend terminal logs
2. Share the exact error message from backend
3. Verify PDF.co API key is working

