@echo off
title SINGULARITY CubeSat Mission Control
color 0b
echo ===============================================================================
echo            SINGULARITY - MODULAR AEROSPACE TELEMETRY MISSION CONTROL
echo                   Black Hole Singularity Edition (Interstellar)
echo ===============================================================================
echo.
echo [1/3] Starting SQLite Backend API Server on http://localhost:3001...
cd /d "%~dp0Backend"
start "SINGULARITY Backend (Port 3001)" cmd /k "npx tsx src/index.ts"

echo [2/3] Starting Simulated Telemetry Bridge on ws://localhost:8081...
cd /d "%~dp0Telemetry_Bridge"
start "SINGULARITY Telemetry Bridge (Port 8081)" cmd /k "node simulated_bridge.js"

echo [3/3] Serving SINGULARITY Aerospace Dashboard on http://localhost:5173...
cd /d "%~dp0Frontend"
start "SINGULARITY Frontend Server (Port 5173)" cmd /k "npx serve -s dist -l 5173"

timeout /t 2 >nul
echo.
echo Launching Dashboard in your default browser...
start "" "http://localhost:5173"
echo.
echo ===============================================================================
echo MISSION CONTROL IS RUNNING!
echo Dashboard:         http://localhost:5173
echo Backend API:       http://localhost:3001
echo Telemetry Bridge:  ws://localhost:8081
echo.
echo (Keep the background terminal windows open while using the dashboard.)
echo ===============================================================================
pause
