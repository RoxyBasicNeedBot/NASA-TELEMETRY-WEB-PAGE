@echo off
title SINGULARITY Hardware Telemetry Bridge (COM6)
color 0a
echo ===============================================================================
echo            SINGULARITY - HARDWARE SERIAL TELEMETRY BRIDGE
echo ===============================================================================
echo.
echo Make sure your ESP8266 receiver is connected via USB to COM6.
echo (If using another COM port, edit bridge.js SERIAL_PORT variable)
echo.
cd /d "%~dp0Backend"
start "SINGULARITY Backend (Port 3001)" cmd /k "npx tsx src/index.ts"

cd /d "%~dp0Telemetry_Bridge"
start "SINGULARITY Hardware Bridge (Port 8081)" cmd /k "node bridge.js"

cd /d "%~dp0Frontend"
start "SINGULARITY Frontend Server (Port 5173)" cmd /k "npx serve -s dist -l 5173"

timeout /t 2 >nul
start "" "http://localhost:5173"
pause
