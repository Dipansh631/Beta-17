# 🔧 Fix Firebase Storage Upload Error

## Problem
Firebase Storage is blocking uploads due to CORS policy and security rules.

## Solution: Update Firebase Storage Security Rules

### Step 1: Go to Firebase Console
1. Open: https://console.firebase.google.com
2. Select your project: **beta-17**

### Step 2: Update Storage Rules
1. Go to **Storage** in the left sidebar
2. Click on the **Rules** tab
3. Replace the existing rules with:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // Allow authenticated users to upload to ngo-ids folder
    match /ngo-ids/{userId}/{fileName} {
      // Only allow the authenticated user to upload to their own folder
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to upload profile photos
    match /profile-photos/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // For development - allow all authenticated uploads
    // ⚠️ For production, remove this and use specific paths above
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **Publish**

### Step 3: Verify Authentication
Make sure you're logged in before uploading files.

## Alternative: Quick Test Rule (Development Only)

For quick testing, you can use this permissive rule (⚠️ **NOT for production**):

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Verify the Fix

1. **Check user is logged in**: Make sure you see your user in the app
2. **Try uploading again**: Upload should work now
3. **Check browser console**: Should see "✅ File uploaded to Firebase Storage"

## Common Issues

### Issue: Still getting "unauthorized" error
- **Solution**: Make sure you're logged in and the user UID matches the folder path

### Issue: CORS error persists
- **Solution**: 
  1. Clear browser cache
  2. Check Firebase Storage rules are published
  3. Verify Firebase Storage is enabled in your project

### Issue: "Storage not initialized"
- **Solution**: Check that Firebase Storage is enabled in Firebase Console

## Files Modified

- ✅ `src/pages/RegisterNGO.tsx` - Added better error handling and logging
- ✅ `firebase-storage-rules.txt` - Storage rules template

---

**After updating the rules, the upload should work!** 🎉

