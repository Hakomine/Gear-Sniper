@echo off
cd /d "%~dp0"
echo.
echo   Gear Sniper - suche nach Schnaeppchen...
echo.
node collector.mjs --mode=fast
if %errorlevel% neq 0 (
  echo.
  echo   Fehler beim Sammeln - siehe Meldung oben.
  echo.
  pause
  exit /b 1
)
echo.
pause
