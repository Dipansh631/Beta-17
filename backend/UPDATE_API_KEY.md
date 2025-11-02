# 🔑 How to Update Gemini API Key

## Option 1: Share Your New API Key
**Send me your new API key** and I'll update the `.env` file for you.

## Option 2: Update Manually

### Step 1: Open `.env` File
Location: `D:\dowl\beta_17\Beta-17-main\backend\.env`

### Step 2: Find This Line
```env
GEMINI_API_KEY=AIzaSyAD33_uVb6BvQ3DVOC8rUgAFAqMDBx7tw0
```

### Step 3: Replace with Your New Key
```env
GEMINI_API_KEY=YOUR_NEW_KEY_HERE
```

### Step 4: Save the File
- Press `Ctrl+S` to save
- Make sure the file is actually saved

### Step 5: Restart Backend
```bash
# Stop the current backend (Ctrl+C)
# Then restart:
cd backend
npm run dev
```

## Verify Update

After updating, check:
```bash
cd backend
Get-Content .env | Select-String "GEMINI_API_KEY"
```

Should show your new key.

---

**💡 Quick Option: Just share your new API key and I'll update it for you!**

