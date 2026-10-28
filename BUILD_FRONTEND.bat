@echo off
title Build SINGULARITY Frontend
color 0e
echo ===============================================================================
echo            BUILDING SINGULARITY PRODUCTION DISTRIBUTION
echo ===============================================================================
echo.
cd /d "%~dp0Frontend"
call npm run build
echo.
if %errorlevel% equ 0 (
    echo ===============================================================================
    echo BUILD SUCCESSFUL! Distribution generated in Frontend\dist
    echo ===============================================================================
) else (
    echo [ERROR] Build failed. Please inspect errors above.
)
pause
