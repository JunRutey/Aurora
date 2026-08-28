@echo off
chcp 65001 >nul 2>&1
title Aurora Admin Server

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     Aurora Admin Server Launcher     ║
echo  ╚══════════════════════════════════════╝
echo.

:: 检查 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  [错误] 未检测到 Node.js，请先安装: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 检查并安装依赖
if not exist "node_modules" (
    echo  [信息] 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo  [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
)

:: 启动服务
echo  [启动] Aurora Admin Server...
echo  [地址] http://localhost:3000
echo.
echo  按 Ctrl+C 停止服务
echo  ─────────────────────────────────────
echo.

node server.js

pause
