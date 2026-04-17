@echo off
setlocal

:: Change to the directory where this script lives
cd /d "%~dp0"

echo ============================================
echo   Hampton Hawks Plant Sales - Update
echo ============================================
echo.
echo [*] Rebuilding images and restarting containers...
echo.

docker-compose up -d --build
if errorlevel 1 (
    echo.
    echo [!] Update failed. See output above.
    pause
    exit /b 1
)

echo.
echo [*] Pruning dangling images...
docker image prune -f >nul

echo.
echo [OK] Update complete.
pause
