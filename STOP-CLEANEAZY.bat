@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
node tools\stop-server.cjs
endlocal
