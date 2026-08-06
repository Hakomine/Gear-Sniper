@echo off
REM Veroeffentlicht beides: Code zu GitHub und Worker zu Cloudflare.
REM
REM Der cd-Befehl unten ist der eigentliche Zweck dieser Datei: wrangler muss
REM aus dem Projektordner laufen. Im Home-Verzeichnis stolpert es ueber die
REM gesperrte Windows-Verknuepfung C:\Users\<name>\Anwendungsdaten und bricht
REM mit einem Berechtigungsfehler ab.
cd /d "%~dp0"

echo.
echo   [1/2] Aenderungen zu GitHub schieben...
echo.
git push
if errorlevel 1 goto :fehler

echo.
echo   [2/2] Worker zu Cloudflare deployen...
echo.
call npx wrangler deploy
if errorlevel 1 goto :fehler

echo.
echo   Fertig. Achte oben darauf, dass ZWEI Bindings gelistet sind:
echo   env.GEAR_KV und env.DATA_BASE
echo.
pause
exit /b 0

:fehler
echo.
echo   Abgebrochen - siehe Meldung oben.
echo   Haeufigster Fall: "fetch first" beim Push. Dann hat der Sammel-Job
echo   auf GitHub neue Preise abgelegt. Loesung:  git pull --rebase
echo.
pause
exit /b 1
