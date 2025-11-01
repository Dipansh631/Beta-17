# Python Dependencies Setup

## Error Fix

If you see these errors:
- `ModuleNotFoundError: No module named 'fastapi'`
- `ModuleNotFoundError: No module named 'docext'`

## Quick Fix

Run this once to install all Python dependencies:

```bash
cd D:\dowl\photo_ver_model\docext-main
python -m pip install fastapi uvicorn gradio-client pandas pillow
python -m pip install -e .
```

Or use the batch file:

```bash
scripts\install-python-deps.bat
```

## What's Installed

### For API Server:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `gradio-client` - Gradio API client
- `pandas` - Data processing
- `pillow` - Image processing

### For Gradio Server:
- `docext` - Document extraction package

## After Installation

Run:

```bash
npm run dev
```

All servers should start properly!

## Using Virtual Environment (Recommended)

For better isolation:

```bash
cd D:\dowl\photo_ver_model\docext-main
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn gradio-client pandas pillow
pip install -e .
```

Then update the batch files to use `venv\Scripts\python.exe` instead of `python`.

