@echo off
echo ====================================
echo Starting DonateFlow Application
echo ====================================
echo.

echo [1/2] Starting Backend Server (Port 3000)...
start "Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Server (Port 8080)...
start "Frontend Server" cmd /k "cd /d %~dp0 && npm run dev:frontend-only"

echo.
echo ====================================
echo Servers are starting!
echo ====================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:8080
echo.
echo Opening browser in 10 seconds...
timeout /t 10 /nobreak >nul
start http://localhost:8080

echo.
echo Press any key to exit this window (servers will continue running)
pause >nul

