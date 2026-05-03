@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-portal-running.ps1"
if errorlevel 1 exit /b 1
start "" "http://localhost:3000/admin.html"
