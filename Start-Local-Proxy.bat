@echo off
rem ============================================================
rem  THE COLD FRONT - one-click local feed proxy launcher
rem
rem  Starts (in one minimized window, loopback-only):
rem    feed proxy   http://127.0.0.1:8799   <- the site's feeds route through it
rem    site mirror  http://127.0.0.1:8080   <- OPEN THIS in your browser
rem
rem  Why the mirror: recent browsers (Chrome's "Local Network Access")
rem  stop PUBLIC sites from reaching localhost services, so the
rem  github.io page can't use the feed proxy in some browsers.
rem  The local mirror is a loopback origin, so it always works.
rem
rem  Safe to run repeatedly (a second instance detects the port and exits).
rem  Stop: Task Manager -> end the powershell.exe whose command line
rem        contains "cf-proxy.ps1".
rem ============================================================
start "THE COLD FRONT proxy" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0proxy\cf-proxy.ps1"
timeout /t 2 >nul
curl -s -o nul -w "feed proxy  http://127.0.0.1:8799/healthz -> HTTP %%{http_code}\n" http://127.0.0.1:8799/healthz
curl -s -o nul -w "site mirror http://127.0.0.1:8080/         -> HTTP %%{http_code}\n" http://127.0.0.1:8080/
echo.
echo Open http://127.0.0.1:8080 in your browser for the live local experience.
echo The public site (kshot3000.github.io/ColdFront) stays up for everyone else.
echo You can leave this window alone - it uses almost no resources.
