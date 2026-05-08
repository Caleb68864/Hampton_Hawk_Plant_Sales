@echo off
setlocal enabledelayedexpansion

:: Change to the directory where this script lives
cd /d "%~dp0"

:: Check for admin rights (needed for firewall rules)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Not running as Administrator.
    echo [!] Right-click start.bat and "Run as administrator" for LAN access.
    echo [!] Continuing without firewall setup -- localhost-only.
    echo.
    goto :start_docker
)

:: --- Firewall Rules ---
echo [*] Configuring Windows Firewall...

netsh advfirewall firewall delete rule name="HamptonHawks-Web" >nul 2>&1
netsh advfirewall firewall delete rule name="HamptonHawks-API" >nul 2>&1

netsh advfirewall firewall add rule name="HamptonHawks-Web" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul
netsh advfirewall firewall add rule name="HamptonHawks-API" dir=in action=allow protocol=TCP localport=8080 profile=private,domain >nul

echo [OK] Firewall rules added for ports 3000 and 8080.
echo.

:start_docker
:: --- Get host IP (skip link-local 169.254.x.x and loopback) ---
set "HOST_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr /v "WSL vEthernet"') do (
    if not defined HOST_IP (
        set "RAW=%%a"
        for /f "tokens=*" %%b in ("!RAW!") do set "CANDIDATE=%%b"
        echo !CANDIDATE! | findstr /b "169.254. 127." >nul || set "HOST_IP=!CANDIDATE!"
    )
)

echo ============================================
echo   Hampton Hawks Plant Sales
echo ============================================
echo.
echo   Local:
echo     Web:      http://localhost:3000
echo     Mobile:   http://localhost:3000/mobile
echo     Connect:  http://localhost:3000/connect-mobile  (QR for phone)
echo     Swagger:  http://localhost:8080/swagger
echo.
if not defined HOST_IP goto :skip_lan
echo   LAN (other devices on your network^):
echo     Web:      http://!HOST_IP!:3000
echo     Mobile:   http://!HOST_IP!:3000/mobile
echo     Connect:  http://!HOST_IP!:3000/connect-mobile  (open this on desktop,
echo                                                      scan QR from phone)
echo     Swagger:  http://!HOST_IP!:8080/swagger
echo.
echo   NOTE: camera scanning on phone requires HTTPS or localhost.
echo         Plain HTTP over LAN works for manual entry only.
echo         See /connect-mobile page for HTTPS tunnel options.
echo.
:skip_lan
echo ============================================
echo.

docker-compose up -d --build

echo.
echo Done!
pause
