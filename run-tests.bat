@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
set "SOLUTION=%ROOT_DIR%api\HamptonHawksPlantSales.sln"
set "OUTPUT_DIR=%ROOT_DIR%test-results"

if not exist "%SOLUTION%" (
  echo [ERROR] Could not find solution file:
  echo         %SOLUTION%
  exit /b 1
)

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"

set "LOG_FILE=%OUTPUT_DIR%\dotnet-test-%STAMP%.log"
set "TRX_FILE=%OUTPUT_DIR%\dotnet-test-%STAMP%.trx"

echo Running tests for: %SOLUTION%
echo Console log: %LOG_FILE%
echo TRX report : %TRX_FILE%
echo.

dotnet test "%SOLUTION%" --configuration Debug --verbosity normal --logger "trx;LogFileName=dotnet-test-%STAMP%.trx" > "%LOG_FILE%" 2>&1
set "TEST_EXIT_CODE=%ERRORLEVEL%"

echo.
echo ===== Test Summary =====
findstr /r /c:"Total tests:" /c:"Passed:" /c:"Failed:" /c:"Skipped:" "%LOG_FILE%"
if errorlevel 1 (
  echo No summary lines found. Open the log file for full details.
)

echo.
echo Finished with exit code: %TEST_EXIT_CODE%
echo Readable output saved to:
echo   %LOG_FILE%
echo Structured test report saved to:
echo   %TRX_FILE%

exit /b %TEST_EXIT_CODE%
