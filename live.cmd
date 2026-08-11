@echo off
cd /d "%~dp0"
title Gear Sniper Live
echo.
echo   Gear Sniper Live - lauert im Umkreis, meldet neue Funde per Discord.
echo.
echo   Laeuft dauerhaft. Beenden mit Strg+C oder Fenster schliessen.
echo.
node sniper-live.mjs %*
echo.
echo   Der Poller ist beendet.
echo.
pause
