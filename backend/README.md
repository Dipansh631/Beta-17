# NGO Registration Backend API

Backend server for NGO registration with Gemini AI and PDF.co integration.

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy `env.template` to `.env`:
```bash
cp env.template .env
```

Edit `.env` and add your API keys:
```
PORT=3000
PDFCO_API_KEY=your_pdfco_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
CORS_ORIGINS=http://localhost:8080,http://localhost:3000
```

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project or use existing
3. Enable:
   - **Authentication** → Google Sign-In
   - **Firestore Database**
4. Go to Project Settings → Service Accounts
5. Click "Generate new private key"
6. Save the JSON file as `serviceAccountKey.json` in the `backend/` folder

### 4. Get API Keys

#### PDF.co API Key
1. Sign up at [PDF.co](https://pdf.co)
2. Go to API Keys section
3. Copy your API key to `.env`

#### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy to `.env`

### 5. Start Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will start on `http://localhost:3000`

## API Endpoints

### POST /api/extract-id
Extract Aadhaar/PAN details from uploaded document.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `file` (JPG/PNG/PDF)

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Ravi Verma",
    "dob": "02-04-1999",
    "gender": "Male",
    "address": "Bhopal, MP",
    "id_number": "XXXX-XXXX-XXXX",
    "id_type": "Aadhaar"
  }
}
```

### POST /api/verify-face
Verify face authenticity using Gemini Vision.

**Request:**
- Method: POST
- Content-Type: application/json
- Body: `{ "image": "data:image/jpeg;base64,..." }`

**Response:**
```json
{
  "success": true,
  "status": "Verified",
  "message": "Face verified successfully"
}
```

### POST /api/register-ngo
Register NGO in Firestore.

**Request:**
- Method: POST
- Content-Type: application/json
- Body: See `routes/registerNgo.js` for structure

**Response:**
```json
{
  "success": true,
  "message": "NGO registered successfully",
  "data": {
    "uid": "user-id",
    "status": "pending_verification"
  }
}
```

## Firestore Structure

```
ngos/
  {uid}/
    profile: {
      name, dob, gender, address,
      id_number, id_type,
      verified: true,
      profile_photo_url
    }
    details: {
      ngo_name, description,
      donation_category,
      contact_email, contact_phone
    }
    status: "pending_verification"
    created_at, updated_at
    conditions/
      {condition_id}/
        title, description,
        fund_estimate, priority
        created_at
```

## Troubleshooting

### Error: API keys not configured
- Make sure `.env` file exists in `backend/` folder
- Verify API keys are correct

### Error: Firebase not initialized
- Download `serviceAccountKey.json` from Firebase Console
- Place it in `backend/` folder
- Or set `GOOGLE_APPLICATION_CREDENTIALS` path in `.env`

### Error: Cannot connect to PDF.co
- Verify your PDF.co API key is correct
- Check your internet connection
- Ensure PDF.co service is available

### Error: Gemini API failed
- Verify your Gemini API key
- Check API quota/limits
- Ensure model names are correct (gemini-pro, gemini-pro-vision)

