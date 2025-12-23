# ✨ BG Remover - Privacy-First Background Removal

<p align="center">
  <strong>Remove Backgrounds • Add Watermarks • 100% Client-Side</strong>
</p>

---

## 🎯 What is BG Remover?

BG Remover is a **privacy-first image tool** that runs **entirely in your browser**. Your images **never leave your device** — all processing happens locally using advanced AI running on WebAssembly.

### 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| **Background Remover** | AI-powered background removal using RMBG-1.4 |
| **Watermark Tool** | Add custom text watermarks with full control |

---

## ✨ Features

- **🛡️ Zero Data Collection** — No accounts, no tracking, no analytics
- **🤖 Local AI Processing** — ML models run in your browser via WebAssembly
- **⚡ Instant Results** — No upload delays, processing starts immediately
- **🌐 Works Offline** — Once loaded, works without internet
- **🎯 No Sign-Up** — Just open and use
- **💻 Open Source** — Inspect our code anytime

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **ML Runtime** | ONNX Runtime Web 1.17.0 (WASM) |
| **BG Model** | RMBG-1.4 (~45MB, cached) |
| **Frontend** | Vanilla HTML5/CSS3/ES6+ |
| **Fonts** | Space Grotesk, JetBrains Mono |
| **Design** | Aurora effects, gradient mesh, glassmorphism |

---

## 🚀 Deployment

### Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Other Platforms

| Platform | Method |
|----------|--------|
| **Netlify** | Drag & drop to [app.netlify.com/drop](https://app.netlify.com/drop) |
| **GitHub Pages** | Settings → Pages → Select branch |

---

## 💻 Run Locally

```bash
npx serve
# Opens at http://localhost:3000
```

---

## 📁 Project Structure

```
bg-remover/
├── index.html      # Landing page
├── styles.css      # Premium dark theme
├── app.js          # Tool logic (ONNX + Watermark)
├── vercel.json     # Deployment config
└── README.md       # Documentation
```

---

## 📄 License

MIT License

---

<p align="center">
  <strong>Built with 💜 for privacy advocates everywhere</strong>
</p>
