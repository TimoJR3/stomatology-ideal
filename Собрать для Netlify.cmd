@echo off
rem Builds dist\ and a zip for manual Netlify upload ("Drop new files").
cd /d "%~dp0"
node tools\build.js --zip
echo.
pause
