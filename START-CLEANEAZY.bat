@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js सापडले नाही. आधी Node.js स्थापित करा.
  pause
  exit /b 1
)
start "CleanEazy sthanika seva" /min node tools\local-server.cjs
for /l %%i in (1,1,10) do (
  node -e "fetch('http://127.0.0.1:4173/__health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>nul
  if not errorlevel 1 goto ready
  timeout /t 1 >nul
)
:ready
start "" "http://127.0.0.1:4173/software/"
endlocal
