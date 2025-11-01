# Docext Service Updates

## ✅ Changes Made

### 1. Updated Endpoint
- Changed from `/api/docext/extract` (proxy) to `http://localhost:5000/api/docext/extract`
- Updated Vite proxy config to point to port 5000

### 2. Retry Mechanism
- Added exponential backoff retry logic (up to 2 retries)
- Initial delay: 1 second
- Exponential backoff: 1s, 2s delays between retries

### 3. Error Handling
- Improved error detection for connection issues
- User-friendly error messages
- Graceful fallback to simulation when API is down

### 4. Toast Notifications
- Integrated toast notifications for error feedback
- Shows "Document extraction failed. Please check backend." message
- Uses destructive variant for errors

## 🔧 Implementation Details

### Retry Logic
```typescript
retryWithBackoff(fn, maxRetries=2, delayMs=1000)
```
- Attempts: 3 total (initial + 2 retries)
- Delay pattern: 1s, 2s
- Only retries on network/connection errors

### Error Callback
```typescript
extractAadhaarDetails(imageUrl, onError?: (message: string) => void)
```
- Optional callback for error handling
- Used to show toast notifications
- Allows custom error handling in components

### Connection Error Detection
Checks for:
- `AbortError`
- `TypeError`
- "Failed to fetch"
- "ECONNREFUSED"
- "network"
- "Connection refused"

## 📝 Usage

### In Components
```typescript
const extracted = await extractAadhaarDetails(base64Image, (errorMsg) => {
  toast({
    title: "Document extraction failed",
    description: errorMsg || "Please check backend.",
    variant: "destructive",
  });
});
```

## 🔄 Backend Requirements

Ensure your backend is running on:
- **Port**: 5000
- **Endpoint**: `http://localhost:5000/api/docext/extract`

## 🐛 Troubleshooting

### "Document extraction failed. Please check backend."
- Backend not running on port 5000
- Network connection issues
- CORS issues (check backend CORS config)

### Retries
- Check console for retry attempts
- Each retry waits before attempting again
- After 2 retries, falls back to simulation

