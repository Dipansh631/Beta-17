# 🚀 Quick Start Guide - NGO Registration System

## Prerequisites Setup

### 1. Backend Setup (First Time)

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create .env file
cp env.template .env

# Edit .env and add your keys:
# - PDFCO_API_KEY=your_key_here
# - GEMINI_API_KEY=your_key_here
```

### 2. Get API Keys

#### PDF.co API Key
1. Sign up: https://pdf.co
2. Go to Dashboard → API Keys
3. Copy key to `backend/.env`

#### Gemini API Key
1. Go to: https://makersuite.google.com/app/apikey
2. Create API key
3. Copy to `backend/.env`

#### Firebase Service Account
1. Go to: https://console.firebase.google.com
2. Select your project
3. Settings → Service Accounts
4. Generate new private key
5. Save as `backend/serviceAccountKey.json`

## Running the Application

### Option 1: Run Everything Together
```bash
# From project root
npm run dev
```
This starts both frontend (port 8080) and backend (port 3000).

### Option 2: Run Separately

**Terminal 1 - Frontend:**
```bash
npm run dev:frontend
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```

## Access Points

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

## Testing the Flow

1. Open http://localhost:8080
2. Login with Google (Firebase Auth)
3. Navigate to "Register as NGO"
4. **Step 1:** Upload Aadhaar/PAN → AI extracts data
5. **Step 2:** Capture live photo → AI verifies face
6. **Step 3:** Enter NGO details → Submit

## Troubleshooting

**Backend won't start:**
- Check if port 3000 is available
- Verify `.env` file exists in `backend/` folder
- Ensure API keys are set correctly

**Frontend can't connect to backend:**
- Verify backend is running on port 3000
- Check `CORS_ORIGINS` in backend `.env`
- Look at browser console for errors

**ID extraction fails:**
- Verify PDF.co API key is correct
- Check PDF.co account has credits
- Ensure file is valid image/PDF format

**Face verification fails:**
- Verify Gemini API key is correct
- Check API quota in Google AI Studio
- Ensure photo shows clear face

---

✅ **Ready to go!** Start both servers and test the registration flow.

