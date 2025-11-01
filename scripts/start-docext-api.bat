@echo off
cd /d D:\dowl\photo_ver_model\docext-main
echo [API] Checking Python dependencies...
python -c "import fastapi" 2>nul || (
    echo [API] Installing FastAPI dependencies...
    python -m pip install fastapi uvicorn gradio-client pandas pillow -q
)
echo [API] Starting Docext API Server on port 8001...
python docext_api_server.py

