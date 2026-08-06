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

REM Der Sammel-Job auf GitHub legt alle 1-3 Stunden neue Preise ab. Ohne das
REM Zusammenfuehren hier scheitert jeder Push mit "fetch first".
git fetch origin
git merge --no-edit origin/main
if errorlevel 1 (
  REM Kollision gibt es praktisch nur bei den erzeugten Datendateien. Dafuer
  REM gilt: der Bot hat recht, seine Version ist die frischere. Am Code
  REM kollidiert nichts, den fasst der Bot nie an.
  echo.
  echo   Datendateien kollidiert - nehme die Version vom Sammel-Job.
  git checkout --theirs prices.json deals.json history.json
  git add prices.json deals.json history.json
  git commit --no-edit
  if errorlevel 1 goto :fehler
)

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
