@echo off
title Deploy to Cloudflare Pages
color 0b
echo ===============================================================================
echo               DEPLOYING SINGULARITY TO CLOUDFLARE PAGES
echo ===============================================================================
echo.
echo [1/2] Building latest Frontend distribution...
cd /d "%~dp0Frontend"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b %errorlevel%
)
echo.
echo [2/2] Deploying directly to Cloudflare Edge...
echo (If this is your first time, a browser window will open to authorize Cloudflare login)
echo.
call npx wrangler pages deploy dist --project-name=singularity-telemetry
echo.
pause
