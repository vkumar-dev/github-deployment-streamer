@echo off
REM GitHub Deployment Streamer - Windows Batch File
REM This batch file runs the gh-streamer CLI tool in a CMD window

echo Starting GitHub Deployment Streamer...
echo.

REM Check if bash is available (Git Bash or WSL)
where bash >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    bash.exe /home/eliza/github/deployment-streamer/run.sh
) else (
    echo Error: bash not found! Please install Git Bash or WSL
    pause
    exit /b 1
)

pause
