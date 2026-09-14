# ABR BATS Kinetic 3D Experience & Performance Showcase

An Apple-style 3D scroll-driven kinetic product experience engineered for high-performance baseball bats, combined with an interactive e-commerce product showcase.

---

## Features

- **Kinetic 3D Scroll-Driven Canvas**: 240 high-definition frames smoothly scrubbed across scroll progress with HiDPI support and zero letterbox borders (Cover/Fit modes).
- **Smooth Fading Hero Overlay**: Elegant `ABR BATS PRO` heading and tagline centered over the 3D scroll animation, smoothly fading between 0% and 30% scroll progress.
- **Fixed Transparent Navigation Bar**: Glassmorphic top bar with direct smooth-scroll anchors, HUD telemetry (frames, progress), and dynamic cart badge.
- **Interactive Modals & Full Interactivity**: BBCOR .50 Size & Drop Spec Chart modal, Express Order Checkout modal with live pricing sync, and Contact Concierge modal.
- **Asynchronous Background Preloading**: Immediate first-frame unlock under 100ms with progressive background worker streaming.
- **Integrated Product Detail Page (PDP)**:
  - Interactive multi-angle image gallery with instant thumbnail switching.
  - Custom size selector (31", 32", 33", 34").
  - Grip profile selector (Textured Black, Matte Stealth, Pro Wrap).
  - Quantity counter stepper and animated "Added to Cart" feedback.
- **Performance Spec Telemetry Strip**: BBCOR .50, Single-Piece Alloy, 2 5/8" Pro Profile, -3 Drop.
- **Ballistic Dynamics & Athlete Reviews**: Complete storytelling and social proof sections.
- **Atelier Dark Aesthetic**: Styled in Obsidian (`#131315`) with Space Grotesk & Manrope typography.

---

## Deploy to Vercel

This repository is pre-configured for automated deployment on [Vercel](https://vercel.com):

1. Import this repository into Vercel:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave default)
   - **Output Directory**: `public` (pre-configured in `vercel.json`)
2. Click **Deploy**.
3. All static assets, rewrites (`/api/frames`), and performance caching headers will be applied automatically.

---

## Local Development

### Option 1: Using Node.js / npx
```bash
npm install
npm start
```
Opens the server on `http://localhost:3000` (or `http://localhost:8080`).

### Option 2: Using PowerShell (Windows native)
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8080
```
Visit [http://localhost:8080/](http://localhost:8080/) in your browser.

---

## Project Structure

```
├── api/
│   └── frames.js               # Vercel Serverless Function fallback for /api/frames
├── public/
│   ├── api/
│   │   └── frames.json         # Static frame manifest for instant Vercel caching
│   ├── frames/                 # 240 high-res 3D frame assets (ezgif-frame-001.jpg .. 240.jpg)
│   ├── app.js                  # Frontend 3D engine & PDP interactivity
│   ├── style.css               # Kinetic typography & dark obsidian styling
│   ├── index.html              # Main HTML entrypoint
│   ├── screen.png              # Mockup reference visual
│   └── DESIGN.md               # Atelier design system tokens
├── scripts/
│   └── generate-manifest.js    # Manifest generator for build steps
├── .env.example                # Example environment variables
├── .gitignore                  # Git ignore rules
├── package.json                # Project metadata & npm scripts
├── vercel.json                 # Vercel deployment configuration & routing
└── README.md                   # Documentation
```

---

## License

MIT © [ABR BATS](https://github.com/abdulrafayzafariqbal7-crypto/Abdul-Rafay-Zafar-Iqbal)
