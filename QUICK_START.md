# Quick Start Guide - Run on Localhost

## Option 1: Double-click START.bat (Easiest)
Just double-click `START.bat` in the project root. It will:
- Start backend server (port 3000)
- Start frontend server (port 8080)
- Open browser automatically

## Option 2: Manual Start

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

### Terminal 2 - Frontend:
```bash
npm run dev:frontend-only
```

## Option 3: Use npm concurrently (Root directory):
```bash
npm run dev
```
This starts both servers in one terminal.

## Access URLs:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000

## Environment Setup:
Make sure `backend/.env` exists with:
- `GEMINI_API_KEY=your_key` (for AI verification)
- `MONGODB_URI=mongodb://localhost:27017` (or Atlas connection string)

## Troubleshooting:
1. **Port already in use**: Close other apps using ports 3000/8080
2. **Module not found**: Run `npm install` in root and `backend` folders
3. **Backend not starting**: Check `backend/.env` file exists
4. **Verification errors**: Make sure `GEMINI_API_KEY` is set in `backend/.env`
