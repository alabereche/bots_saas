@echo off
title AuraBot Admin (local)
cd /d "%~dp0"
echo.
echo   Admin panel  : http://localhost:8090/index.html
echo   Keep this window open while using the panel.
echo.
start "" cmd /c "timeout /t 1 >nul & start http://localhost:8090/index.html"
py -m http.server 8090
