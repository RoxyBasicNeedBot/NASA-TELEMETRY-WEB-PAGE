# 🌌 SINGULARITY — CubeSat Telemetry Mission Control
> **Theme:** Black Hole Singularity + Interstellar Cinematic Space + Apple Liquid Glass UI  
> **Team:** SINGULARITY  
> **Hardware Stack:** ESP8266 + ESP-NOW + DHT11 + MPU6050 + BMP280 + NEO-6M GPS  

---

## 📁 Folder Structure

```
SINGULARITY_Mission_Control/
├── 1_CLICK_RUN_MISSION_CONTROL.bat   ← Double click to run EVERYTHING (Simulator + Backend + Frontend)
├── RUN_WITH_REAL_HARDWARE.bat        ← Double click to run with real ESP8266 COM6 hardware
├── DEV_MODE_HOT_RELOAD.bat           ← Double click to start Vite live dev server (HMR)
├── BUILD_FRONTEND.bat                ← Double click to rebuild production files after code changes
│
├── Frontend/                         ← React 19 + TypeScript + Tailwind + Three.js + Recharts
│   ├── src/                          ← All source code (components, widgets, stores, etc.)
│   ├── dist/                         ← Compiled production assets
│   ├── package.json
│   └── vite.config.ts
│
├── Backend/                          ← Express + SQLite persistent database
│   ├── src/                          ← Backend endpoints (/api/telemetry, /health, export)
│   ├── data/                         ← Local SQLite database file
│   └── package.json
│
├── Telemetry_Bridge/                 ← WebSocket Telemetry Gateway
│   ├── bridge.js                     ← Serial bridge reading from ESP8266 (COM6 @ 115200 baud)
│   ├── simulated_bridge.js           ← Realistic CubeSat simulation for testing without hardware
│   └── package.json
│
└── Firmware/                         ← Microcontroller source code (.ino files)
    ├── TX_cubesat.ino                ← CubeSat satellite transmitter code (sensors + ESP-NOW)
    ├── RX_cubesat.ino                ← Ground station receiver code (ESP-NOW to Serial JSON)
    └── RX_MAC_Address.ino            ← Utility to retrieve receiver ESP8266 MAC address
```

---

## 🚀 How to Run

### Option A: Testing / Demo (No Hardware Needed)
1. Double-click `1_CLICK_RUN_MISSION_CONTROL.bat`
2. It automatically starts:
   - SQLite Database & API at `http://localhost:3001`
   - Real-time Satellite Telemetry Simulator at `ws://localhost:8081`
   - Frontend Dashboard at `http://localhost:5173`
   - Automatically opens your default web browser!

### Option B: Real CubeSat Hardware (Ground Station)
1. Plug your Ground Station ESP8266 receiver into USB (COM6 by default).
2. Double-click `RUN_WITH_REAL_HARDWARE.bat`.
3. If your USB port is not COM6, open `Telemetry_Bridge\bridge.js` and change `SERIAL_PORT = "COMx"`.

---

## 🛠️ How to Update and Modify Code in Future

### To edit UI / Components:
1. Open `Frontend\src` in VS Code or any editor.
2. Key files:
   - `Frontend\src\app\AppLayout.tsx` — Header, Logo, Navigation bar
   - `Frontend\src\features\setup\SetupWizard.tsx` — Setup sequence & mission launch
   - `Frontend\src\components\BlackHoleTransition.tsx` — Interstellar black hole gravitational transition
   - `Frontend\src\components\widgets\CubeSatViewer.tsx` — 3D Three.js rotating satellite
   - `Frontend\src\components\widgets\GpsMapWidget.tsx` — Orbital GPS ground track map
   - `Frontend\src\index.css` — Interstellar dust background, glassmorphism, animations
3. Double-click `DEV_MODE_HOT_RELOAD.bat` to see changes live instantly!
4. When finished, double-click `BUILD_FRONTEND.bat` to create the final optimized distribution.

---

## 🛰️ Visual Theme Features
- **Interstellar Deep Space Background:** Warm cosmic dust lanes, silver-white stars, and black void gradients modeled after Nolan's Interstellar.
- **Black Hole Gravitational Transition:** Accretion disk rings, event horizon gravitational warping, and spherical spatial expansion into the telemetry dashboard.
- **Apple Liquid Glass:** `backdrop-filter: blur(40px) saturate(180%)`, specular highlight borders, and subtle cosmic violet glow.
- **3D Satellite Attitude:** Real-time Roll, Pitch, and Yaw attitude visualized using Three.js.
