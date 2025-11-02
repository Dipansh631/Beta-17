# Installing LLaVA Model Dependencies

## Python Dependencies Required

The LLaVA model requires Python and specific packages. Follow these steps:

### Step 1: Install Python (if not installed)
1. Download Python 3.10+ from https://www.python.org/downloads/
2. During installation, check "Add Python to PATH"
3. Verify installation: `python --version`

### Step 2: Install Python Dependencies

Open a terminal in the `backend` folder and run:

```bash
cd backend
pip install -r requirements_verification.txt
```

Or install individually:

```bash
pip install torch>=2.0.0
pip install transformers>=4.35.0
pip install pillow>=10.0.0
pip install accelerate>=0.24.0
pip install sentencepiece>=0.1.99
pip install protobuf>=4.25.0
```

### Step 3: Verify Installation

Test if dependencies are installed:

```bash
python -c "import transformers; print('OK')"
python -c "import torch; print('OK')"
```

### Step 4: First Run Notes

⚠️ **Important**: The first time LLaVA runs, it will download the model (~14GB):
- Model: `llava-hf/llava-1.5-7b-hf`
- This can take 15-30 minutes depending on internet speed
- Model is cached after first download

### Step 5: Test LLaVA Verification

1. Start backend server: `cd backend && npm run dev`
2. Start frontend server: `npm run dev:frontend-only`
3. Navigate to http://localhost:8080
4. Upload an image with NGO conditions to test verification

### Troubleshooting

**If pip is not found:**
- Reinstall Python and check "Add Python to PATH"
- Or use: `python -m pip install -r requirements_verification.txt`

**If installation fails:**
- Try: `pip install --upgrade pip`
- Then retry installation

**GPU Support (Optional):**
- If you have NVIDIA GPU, PyTorch will automatically use it
- For CPU-only, installation still works (slower inference)

**Memory Requirements:**
- Model needs ~8GB RAM minimum
- First download needs ~14GB disk space

---

After installing dependencies, restart the backend server to use LLaVA verification.

