# Fixing Network Error - Backend Not Running

## Problem
**Error:** `ERR_CONNECTION_REFUSED` when trying to access `http://localhost:3000/api/extract-id`

**Cause:** Backend server is not running

## Solution

### Step 1: Start Backend Server

Open a **new terminal** and run:

```bash
cd D:\dowl\beta_17\Beta-17-main\backend
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3000
📋 Health check: http://localhost:3000/health
```

### Step 2: Verify Backend is Running

Open in browser: http://localhost:3000/health

Should return: `{"status":"ok","message":"NGO Registration API is running"}`

### Step 3: Keep Backend Running

**Important:** Keep the backend terminal window open while using the app!

The backend needs to stay running for:
- ID extraction (`/api/extract-id`)
- Face verification (`/api/verify-face`)
- NGO registration (`/api/register-ngo`)

## Quick Fix Command

If backend stops, restart it:
```bash
cd backend
npm run dev
```

## Alternative: Run Both Servers Together

From project root:
```bash
npm run dev
```

This starts both frontend and backend automatically.

## Test the Fix

1. Make sure backend is running (check http://localhost:3000/health)
2. Open frontend: http://localhost:8080
3. Navigate to `/register-ngo`
4. Upload an ID image
5. Should now connect successfully!

---

**Note:** The frontend has been updated to use Vite proxy, so `/api/*` requests will automatically route to `http://localhost:3000/api/*` when both are running.

