@echo off
chcp 936 >nul 2>&1
setlocal EnableExtensions EnableDelayedExpansion

:: Paths
set "SCRIPT_DIR=%~dp0"
set "ADMIN_DIR=%SCRIPT_DIR%"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"

title Aurora Admin Server

echo.
echo  ============================================
echo    Aurora Admin Server Launcher
echo  ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install: https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v 2^>nul') do set "NODE_VER=%%i"
echo  [ENV] Node.js %NODE_VER%

:: Install deps
cd /d "%ADMIN_DIR%"
if not exist "node_modules" (
    echo  [INSTALL] First run, installing dependencies...
    call npm install --no-fund --no-audit --prefix "%ADMIN_DIR%"
    if errorlevel 1 (
        echo  [ERROR] npm install failed
        echo.
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed
    echo.
)

:: Kill old processes
echo  [CLEAN] Checking old processes...
set "KILLED=0"
for /f "tokens=2 delims=," %%p in ('tasklist /fi "imagename eq node.exe" /fo csv /nh 2^>nul ^| findstr /i "node.exe"') do (
    set "PID=%%~p"
    for /f "tokens=*" %%c in ('wmic process where "ProcessId=!PID!" get CommandLine /format:list 2^>nul ^| findstr /i "admin-server"') do (
        taskkill /pid !PID! /f >nul 2>&1
        set "KILLED=1"
    )
)
if "!KILLED!"=="1" (
    echo  [OK] Old process killed
    timeout /t 1 >nul 2>&1
) else (
    echo  [SKIP] No old process found
)
echo.

:: Check port
set "PORT=3000"
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [WARN] Port %PORT% already in use
    echo.
)

:: Info
echo  ============================================
echo    Project: %PROJECT_ROOT%
echo    Server:  http://localhost:%PORT%
echo    Press Ctrl+C to stop
echo  ============================================
echo.

:: Open browser
start "" "http://localhost:%PORT%"

:: Start
node server.js

if errorlevel 1 (
    echo.
    echo  [ERROR] Server exited with code %errorlevel%
    echo.
    pause
    exit /b %errorlevel%
)
exit /b 0