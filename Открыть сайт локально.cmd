@echo off
rem Opens the site locally with the same security headers. Requires Node.js. Close the window to stop.
cd /d "%~dp0"
start "" http://127.0.0.1:8731
node tools\serve.js src 8731
