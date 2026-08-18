# Scherbenfeld

Ein Survivor-like als Prototyp. Man bewegt sich, geschossen wird von allein,
Gegner kommen in Wellen, XP-Kristalle bringen Aufwertungen. Vorbild ist
Vampire Survivors.

**Der Prototyp beantwortet eine einzige Frage: Macht es Spaß?** Alles andere —
Steam, Grafik, Umfang — kommt erst danach. Wenn die Antwort nein lautet, hat es
einen Nachmittag gekostet und kein Geld. Genau dafür ist die Reihenfolge
gewählt.

Keine Laufzeit-Abhängigkeiten: TypeScript, Canvas 2D, sonst nichts.

## Losspielen

```bash
npm install
npm run dev        # http://localhost:5173
```

WASD oder Pfeiltasten bewegen, Gamepad geht auch. Beim Levelup wählt man mit
A/D und bestätigt mit Leertaste — oder drückt gleich 1, 2 oder 3.

## Nachprüfen

```bash
npm run check      # TypeScript
npm run test       # 37 Tests: Schaden, Aufstiegskurve, Determinismus
npm run perf       # Simulation ohne Zeichnen, misst ms pro Tick
npm run smoke      # startet das Spiel im Browser, legt Screenshots ab
```

`npm run smoke` braucht einen Chromium. Bringt Playwright seinen eigenen mit,
läuft es ohne Zutun. Ist bereits einer da, der nicht zur Playwright-Version
passt, zeigt man ihm den vorhandenen:

```bash
CHROMIUM_PFAD=/opt/pw-browsers/chromium npm run smoke
```

Die Bilder landen in `screenshots/`.

## Wie es aufgebaut ist

```
src/
  core/     Zeitschritt, Eingabe, Zufall, Kollisionsgitter, Objektpools
  game/     Die Simulation  — kennt keinen Browser
  render/   Zeichnen, Partikel, Erschütterung, Anzeige
  ui/       Menüs und alle Texte
```

### Die Spiellogik kennt keinen Browser

In `src/game/` steht kein `document`, kein `window`, kein Canvas. Das ist keine
Stilfrage, sondern zahlt sich dreifach aus:

- Die Regeln lassen sich ohne Browser testen.
- `npm run perf` misst die reine Rechenlast, ohne dass ein Bildpunkt entsteht.
- Ein späteres Verpacken für Steam (Tauri, Electron) fasst nur `main.ts` an.

Die Importe laufen sternförmig: `state.ts` holt sich Funktionen aus den
Teilsystemen, die Teilsysteme holen sich von dort nur *Typen*. Dadurch gibt es
keine gegenseitigen Importe.

### Inhalte sind Daten

Gegner, Waffen und Aufwertungen sind schlichte Objekte in
`enemies.ts`, `weapons.ts` und `upgrades.ts`. Ein neuer Gegner ist ein
Tabelleneintrag, kein neuer Code. In diesem Genre *ist* die Inhaltsmenge das
Produkt — wer für jeden Gegner eine Klasse schreibt, baut nach dem zwanzigsten
keine mehr.

### Die Form sagt, was es ist. Die Farbe sagt, wie es ihm geht.

| Form | Gegner | Verhalten |
|---|---|---|
| **Dreieck** | Splitter | schnell, dünn, Spitze zeigt auf dich |
| **Quadrat** | Brocken | langsam, zäh, optisch ruhig |
| **Sechseck** | Kantiger | Elite, dreht sich, viel Leben |

Bei tausend Gegnern kann man Farben nicht mehr auseinanderhalten, Umrisse aber
sehr wohl. Die Farbe bleibt deshalb für Zustände frei: weiß = gerade getroffen.

### Gesetzter Zufall

Jeder Zufall läuft über `core/rng.ts`, nie über `Math.random()`. Zwei getrennte
Ströme: `rng` beeinflusst den Lauf, `rngOptik` nur das Aussehen. Deshalb
verändert eine neue Partikelwolke nicht die Gegnerabfolge — dafür gibt es einen
eigenen Test.

Das kostet fast nichts und bringt drei Dinge: reproduzierbare Fehler,
deterministische Tests und einen „Täglichen Lauf" als späteres
Wiederkehr-Feature (`tagesSaat()` liegt schon bereit).

## Was gemessen ist

`npm run perf` fährt die volle Simulation bei voller Gegnerzahl, 3000 Ticks,
ohne zu zeichnen. Budget: 5 ms pro Tick, bei 60 Hz stehen 16,6 ms zur Verfügung.

| Gegner | Mittel | p95 |
|---|---|---|
| 1400 (Obergrenze) | 1,8 ms | 2,4 ms |
| 2000 | 4,5 ms | 5,8 ms |

Der Anstieg ist überproportional, weil die Dichte quadratisch in die
Nachbarschaftsabfragen eingeht. Die Obergrenze steht deshalb bei 1400 — dort,
wo die Messung sie trägt.

Beim Messen kam eine Sache heraus, die man nicht vermutet: Das
Auseinanderdrücken der Gegner **spart** Rechenzeit. Wird die Trennkraft
gedeckelt, verklumpen die Gegner, und dann liefert jede Gitterabfrage riesige
Kandidatenlisten — mit Deckel kostete derselbe Zustand 11,7 statt 4,5 ms.

## Was die Screenshots geändert haben

Das Spiel selbst zu starten und anzusehen war kein Häkchen, sondern hat vier
echte Fehler gefunden, die keine Zahl gezeigt hätte:

- **Die ersten Sekunden waren tot.** Vom Spawnring braucht ein Gegner zehn
  Sekunden bis zum Spieler. Jetzt gibt es eine Startwelle auf halbem Weg.
- **Alles war zu klein.** Ein Gegner mit 9 Punkten Radius auf 1280 Punkten
  Breite ist Fliegendreck. Die Kamera steht jetzt näher dran.
- **Der Spieler verschwand im Getümmel.** Zweimal: erst ging er in der Masse
  unter (jetzt dunkler Hof darunter), dann fiel auf, dass er beim Blinken gar
  nicht gezeichnet wurde — wer dauernd Treffer kassiert, ist dauernd
  unverwundbar und damit dauernd unsichtbar.
- **Gleichfarbige Gegner verschmolzen zur Fläche.** Jetzt trennt eine dunkle
  Kante jeden Körper.

## Was noch fehlt

- **Ton.** Kein einziger. In diesem Genre fehlt damit ein guter Teil der Wucht.
- **Mehr Inhalt.** Eine Waffe, drei Gegnertypen, zehn Aufwertungen. Für die
  Spaß-Frage reicht das, für einen Verkauf bei weitem nicht.
- **Zwischenbilder.** Bei 144 Hz ist eine leichte Unruhe sichtbar, weil
  zwischen zwei Logikschritten nicht interpoliert wird.
- **Kein Endgegner, kein Ende.** Der Lauf hört auf, wenn man stirbt.

## Bevor daraus etwas Verkäufliches wird

**Dieses Repo ist öffentlich.** Für einen Prototyp ist das egal. Ein Spiel, das
Geld kosten soll, gehört in ein eigenes, privates Repo — sonst kann jeder den
Quelltext übersetzen und weitergeben. `game/` ist deshalb von Anfang an ein in
sich geschlossenes Projekt ohne jede Verbindung zum Sniper-Code daneben: Der
Umzug ist ein `git subtree split` und kein Umbau.

Der Steam-Weg wäre danach 100 USD pro Titel (rückvergütet ab 1.000 USD Umsatz),
30 % Anteil für Valve, 30 Tage Sperrfrist nach Zahlung und eine mindestens zwei
Wochen vorher öffentliche Store-Seite — realistisch vier bis sechs Wochen
Formalitäten.
