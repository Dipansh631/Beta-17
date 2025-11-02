# Start Both Servers Script for Windows
# This script starts both backend and frontend servers

Write-Host "🚀 Starting DonateFlow Application..." -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Check and install frontend dependencies
Write-Host "📦 Checking frontend dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   Installing frontend dependencies (this may take a minute)..." -ForegroundColor Yellow
    npm install
}

# Check and install backend dependencies
Write-Host "📦 Checking backend dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "   Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

# Check Python dependencies for CLIP (optional)
Write-Host "🐍 Checking Python dependencies for CLIP verification..." -ForegroundColor Yellow
try {
    $null = python -c "import transformers; print('OK')" 2>$null
    Write-Host "   ✅ Python dependencies OK" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Python transformers not installed. CLIP verification will fallback to Gemini." -ForegroundColor Yellow
    Write-Host "   To install: cd backend; pip install -r requirements_verification.txt" -ForegroundColor Yellow
}

# Check .env file
$backendEnvPath = Join-Path "backend" ".env"
if (-not (Test-Path $backendEnvPath)) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item "backend\env.example" $backendEnvPath
    Write-Host "   ⚠️  Please edit backend/.env and add your GEMINI_API_KEY and MONGODB_URI" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Starting servers..." -ForegroundColor Green
Write-Host "   Backend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""

# Get current directory
$currentDir = Get-Location

# Start backend in a new window
Write-Host "Starting backend server..." -ForegroundColor Yellow
$backendPath = Join-Path $currentDir "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host '🔧 Backend Server (Port 3000)' -ForegroundColor Green; Write-Host ''; npm run dev"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend in a new window
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$currentDir'; Write-Host '🎨 Frontend Server (Port 8080)' -ForegroundColor Green; Write-Host ''; npm run dev:frontend-only"

Write-Host ""
Write-Host "✅ Servers starting in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Wait for both servers to start (about 10-15 seconds)" -ForegroundColor White
Write-Host "   2. Open http://localhost:8080 in your browser" -ForegroundColor White
Write-Host "   3. If CLIP verification needed, install: cd backend; pip install -r requirements_verification.txt" -ForegroundColor White
Write-Host ""
