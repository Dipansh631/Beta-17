# NGO Registration System - Setup Guide

Complete setup guide for the NGO Registration system with Firebase, Gemini AI, and PDF.co.

## 🚀 Quick Start

### Frontend Setup
```bash
# Install dependencies (if not already done)
npm install

# Start frontend dev server
npm run dev
```
Frontend runs on: http://localhost:8080

### Backend Setup
```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create .env file from template
cp env.template .env

# Edit .env and add your API keys:
# - PDFCO_API_KEY
# - GEMINI_API_KEY

# Place serviceAccountKey.json in backend/ folder

# Start backend server
npm run dev
```
Backend runs on: http://localhost:3000

## 📋 Prerequisites

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project: `CommunityDonationTracker`
3. Enable:
   - **Authentication** → Google Sign-In
   - **Firestore Database** → Create database (start in test mode)
4. Get Service Account Key:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download JSON file
   - Save as `backend/serviceAccountKey.json`

### 2. PDF.co API Key
1. Sign up at [PDF.co](https://pdf.co)
2. Go to API Keys section in dashboard
3. Copy your API key
4. Add to `backend/.env` as `PDFCO_API_KEY`

### 3. Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key
4. Add to `backend/.env` as `GEMINI_API_KEY`

## 📁 Project Structure

```
Beta-17-main/
├── backend/
│   ├── routes/
│   │   ├── extractId.js      # ID extraction route
│   │   ├── verifyFace.js      # Face verification route
│   │   └── registerNgo.js     # NGO registration route
│   ├── uploads/               # Temporary file storage
│   ├── server.js              # Main server file
│   ├── package.json
│   ├── .env                   # Environment variables (create from template)
│   └── serviceAccountKey.json  # Firebase Admin SDK key
│
├── src/
│   ├── pages/
│   │   └── RegisterNGO.tsx   # 3-step NGO registration form
│   ├── contexts/
│   │   └── AuthContext.tsx    # Firebase Auth context
│   └── ...
│
└── vite.config.ts             # Vite config with API proxy
```

## 🔧 Environment Variables

### Backend (.env)
```env
PORT=3000
PDFCO_API_KEY=your_pdfco_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
CORS_ORIGINS=http://localhost:8080,http://localhost:3000
```

## ✅ Testing the Setup

### 1. Test Backend
```bash
cd backend
npm run dev
```

Open: http://localhost:3000/health
Should return: `{"status":"ok","message":"NGO Registration API is running"}`

### 2. Test Frontend
```bash
npm run dev
```

Open: http://localhost:8080
Navigate to: http://localhost:8080/register-ngo

### 3. Test Flow
1. **Login** with Google (Firebase Auth)
2. **Upload Aadhaar/PAN** card image
3. **Verify extracted data** and confirm
4. **Capture live photo** for face verification
5. **Enter NGO details** and funding conditions
6. **Submit** registration

## 🔐 Security Notes

- ✅ API keys are stored in backend `.env` (never in frontend)
- ✅ Backend acts as proxy for Gemini + PDF.co APIs
- ✅ CORS is configured to allow only frontend origins
- ✅ Helmet.js is used for security headers
- ✅ File uploads are limited to 10MB

## 🐛 Troubleshooting

### Error: "API keys not configured"
- Make sure `.env` file exists in `backend/` folder
- Verify API keys are correct and not empty
- Check for typos in variable names

### Error: "Firebase not initialized"
- Download `serviceAccountKey.json` from Firebase Console
- Place it in `backend/` folder
- Verify path in `.env`: `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json`

### Error: "Cannot connect to PDF.co"
- Verify your PDF.co API key is correct
- Check your internet connection
- Ensure PDF.co service is available

### Error: "Gemini API failed"
- Verify your Gemini API key is correct
- Check API quota/limits in Google AI Studio
- Ensure model names are correct (gemini-pro, gemini-pro-vision)

### Frontend: "Failed to fetch"
- Make sure backend server is running on port 3000
- Check CORS_ORIGINS in backend/.env includes frontend URL
- Verify API_BASE_URL in frontend code

## 📝 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/extract-id` | POST | Extract Aadhaar/PAN data |
| `/api/verify-face` | POST | Verify face authenticity |
| `/api/register-ngo` | POST | Register NGO in Firestore |

## 🎨 Features

- ✅ **ID Extraction**: Automatic extraction from Aadhaar/PAN using PDF.co OCR + Gemini AI
- ✅ **Face Verification**: Live photo verification using Gemini Vision
- ✅ **3-Step Form**: Clean, intuitive multi-step registration
- ✅ **Real-time Validation**: Immediate feedback on each step
- ✅ **Firestore Integration**: Structured data storage
- ✅ **Error Handling**: Comprehensive error messages and fallbacks

## 📞 Support

If you encounter issues:
1. Check the console logs (frontend and backend)
2. Verify all API keys are correct
3. Ensure Firebase is properly configured
4. Check network connectivity

---

**Ready to register NGOs!** 🎉

