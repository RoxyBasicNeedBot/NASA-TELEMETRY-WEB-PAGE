@echo off
title Deploy to Cloudflare Worker
color 0b
echo ===============================================================================
echo            DEPLOYING TO CLOUDFLARE WORKER (nasa-telemetry-web-page)
echo ===============================================================================
echo.
echo [1/2] Building Frontend distribution...
cd /d "%~dp0Frontend"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b %errorlevel%
)
cd /d "%~dp0"
echo.
echo [2/2] Deploying Worker with Assets to Cloudflare...
call npx wrangler deploy
echo.
pause
