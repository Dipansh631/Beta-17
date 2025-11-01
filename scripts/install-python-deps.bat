@echo off
echo ========================================
echo Installing Python Dependencies
echo ========================================
echo.

cd /d D:\dowl\photo_ver_model\docext-main

echo [1/2] Installing FastAPI and dependencies...
python -m pip install fastapi uvicorn gradio-client pandas pillow -q
if %errorlevel% neq 0 (
    echo ERROR: Failed to install FastAPI dependencies
    pause
    exit /b 1
)

echo [2/2] Installing docext package...
python -m pip install -e . -q 2>nul
if %errorlevel% neq 0 (
    echo Trying alternative installation...
    python -m pip install docext -q
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install docext
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
pause

