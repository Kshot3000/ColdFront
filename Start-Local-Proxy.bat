@echo off
rem ============================================================
rem  THE COLD FRONT - one-click local feed proxy launcher
rem  Double-click to start. Safe to run repeatedly (won't double-start).
rem  Stop: Task Manager -> end the powershell.exe running cf-proxy.ps1
rem ============================================================
start "THE COLD FRONT proxy" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0proxy\cf-proxy.ps1"
timeout /t 2 >nul
curl -s -o nul -w "healthz: HTTP %%{http_code}\n" http://127.0.0.1:8799/healthz
echo.
echo If healthz says 200, the site's feeds will go live on their next refresh.
echo You can leave that window alone — it uses almost no resources.
