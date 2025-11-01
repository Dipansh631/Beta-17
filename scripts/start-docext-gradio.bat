@echo off
cd /d D:\dowl\photo_ver_model\docext-main
echo [Gradio] Checking docext package...
python -c "import docext" 2>nul || (
    echo [Gradio] Installing docext package...
    python -m pip install -e . -q 2>nul || python -m pip install docext -q
)
echo [Gradio] Starting Docext Gradio Server on port 7860...
python -m docext.app.app

