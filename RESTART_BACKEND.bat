@echo off
echo ====================================
echo Restarting Backend Server
echo ====================================
echo.

echo Stopping existing backend processes on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing process %%a
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo.
echo Starting backend server...
cd /d %~dp0backend
start "Backend Server - Port 3000" cmd /k "npm run dev"

echo.
echo ✅ Backend server restarting...
echo    Wait a few seconds for it to fully start
echo.
echo    Check: http://localhost:3000/health
echo.
pause

