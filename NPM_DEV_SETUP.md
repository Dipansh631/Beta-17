# NPM Run Dev - All Servers Setup

## ✅ Setup Complete!

Now you can start **ALL servers** with just one command:

```bash
npm run dev
```

This will start:
1. **Frontend Dev Server** (Port 8080) - Your React app
2. **Docext API Server** (Port 8001) - For Aadhaar extraction
3. **Docext Gradio Server** (Port 7860) - AI model backend

## What You'll See

When you run `npm run dev`, you'll see output from all 3 servers with color-coded prefixes:
- 🔵 **Frontend** - Vite dev server
- 🟢 **API** - Docext API server  
- 🟡 **Gradio** - Docext Gradio server

## Additional Commands

### Start Frontend Only
```bash
npm run dev:frontend-only
```

### Individual Server Commands
```bash
npm run dev:frontend     # Frontend only
npm run dev:docext-api   # API server only
npm run dev:docext-gradio # Gradio server only
```

## First Run Notes

- **Gradio Server**: First run will download the AI model (~5-10GB)
  - This may take 10-30 minutes depending on your internet
  - Only happens once!

- **API Server**: Will show connection errors until Gradio is running
  - This is normal - wait for Gradio to start first

## Verify Servers

After running `npm run dev`, wait 15-20 seconds, then check:

1. **Frontend**: http://localhost:8080 ✅
2. **API Health**: http://localhost:8001/health ✅
3. **Gradio**: http://localhost:7860 ✅

## Stopping Servers

Press `Ctrl+C` in the terminal to stop all servers at once.

## Troubleshooting

### "concurrently" not found
```bash
npm install --save-dev concurrently
```

### Port already in use
- Check if another instance is running
- Stop it or change ports in config files

### Python not found
- Make sure Python is in your PATH
- Or update paths in `scripts/*.bat` files

