@echo off
echo ================================================
echo  KTU Activity Points - Setup and Start
echo ================================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download from: https://nodejs.org
    pause
    exit /b 1
)

echo [1/2] Installing dependencies...
cd /d "%~dp0"
npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Make sure you have internet connection.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting server...
echo.
echo  Server: http://localhost:3000
echo  Admin:  username=admin  password=admin123
echo.
node server/index.js
pause
