@echo off
title SINGULARITY Frontend Developer Mode (Hot Reload)
color 0d
echo ===============================================================================
echo            SINGULARITY - FRONTEND DEVELOPER SERVER (VITE HMR)
echo ===============================================================================
echo.
echo Changes you make in Frontend\src will update live in the browser!
echo.
cd /d "%~dp0Frontend"
npm run dev
pause
