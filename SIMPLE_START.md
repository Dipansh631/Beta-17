# Simple Start Guide - Single Command

## ✅ Start Both Servers with One Command

Simply run from the project root:

```bash
npm run dev
```

This will:
- ✅ Start **Backend** server on port **3000**
- ✅ Start **Frontend** server on port **8080**
- ✅ Display both outputs in one terminal with color-coded prefixes
- ✅ Auto-restart both when files change

## 📋 What You'll See

```
[Frontend] VITE ready in 500 ms
[Frontend] ➜  Local:   http://localhost:8080/
[Backend] 🚀 Server running on http://localhost:3000
[Backend] ✅ MongoDB ready for file storage
```

## 🌐 Access URLs

- **Frontend (Website)**: http://localhost:8080
- **Backend API**: http://localhost:3000

## 🛑 To Stop

Press `Ctrl + C` in the terminal to stop both servers.

## 📝 Notes

- Both servers run in the same terminal window
- Color-coded output: Blue for Frontend, Green for Backend
- File changes trigger auto-reload for both
- If one server crashes, you'll see it in the output

---

**That's it!** Just `npm run dev` and you're ready to go! 🚀

