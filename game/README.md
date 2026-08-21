# Scherbenfeld

Ein Survivor-like als Prototyp, in der Richtung von **Vampire Survivors** und
**Brotato** — mit einer eigenen Regel, die kein anderes Spiel hat.

Man bewegt sich, geschossen wird von allein, Gegner kommen in Wellen,
XP-Kristalle bringen Aufwertungen. Der Reiz entsteht aus der *Kombination*
mehrerer Waffen, nicht daraus, dass eine Zahl steigt.

Keine Laufzeit-Abhängigkeiten: TypeScript, Canvas 2D, sonst nichts.

## Losspielen

```bash
npm install
npm run dev        # http://localhost:5173
```

WASD oder Pfeiltasten bewegen, Gamepad geht auch. Beim Levelup wählt man mit
A/D und bestätigt mit Leertaste — oder drückt gleich 1, 2 oder 3.

## Was daran eigen ist: Risse und Zersplitterung

Gegner sind hier Glas, kein Fleisch.

- Trifft eine Waffe einen Gegner, hinterlässt sie einen **Riss** — aber nur
  eine Waffe, die ihn nicht schon gerissen hat. Fünf Treffer derselben Waffe
  bleiben ein Riss.
- Jeder offene Riss erhöht den Schaden, den dieser Gegner nimmt, um 30 %.
- Bei **drei Rissen von drei verschiedenen Waffen** innerhalb von 1,6 Sekunden
  **zersplittert** er: 60 % seiner vollen Trefferpunkte auf einen Schlag, und
  die Scherben verletzen alles im Umkreis. Was dort schon zwei Risse trägt,
  platzt mit — eine Kettenreaktion durch die Menge.

Das ist der Grund, warum der stärkste Bau eine *Mischung* ist und nicht fünfmal
dieselbe Waffe. Die Frage auf jeder Karte wird „passt das zu dem, was ich schon
trage?" statt „ist die Zahl größer?".

Weiße Bruchlinien auf den Formen machen es sichtbar — ohne sie platzen Gegner
scheinbar grundlos.

## Der Waffenkasten

Fünf Plätze, acht Waffen, vier Seltenheiten.

| Waffe | Seltenheit | Was sie tut |
|---|---|---|
| **Splitterwerfer** | gewöhnlich | Startwaffe, schnelle gerade Schüsse |
| **Klinge** | gewöhnlich | Bogenhieb, trifft alles in der Nähe |
| **Kurzbogen** | selten | zielsuchende Pfeile, durchschlagen |
| **Kettenblitz** | selten | springt von Gegner zu Gegner |
| **Bazooka** | episch | träge Granate, großer Flächenknall |
| **Trabanten** | episch | Scherben kreisen dauerhaft um dich |
| **Prismastrahl** | legendär | Sofort-Laser quer durchs Bild |
| **Sternenschlucker** | legendär | schwarzes Loch: saugt an, hält fest, detoniert |

Auf der letzten Stufe wird eine Waffe nicht stärker, sondern **etwas anderes**:
Die Klinge haut rundum statt nach vorn, der Prismastrahl feuert als Kreuz, die
Bazooka wirft drei Granaten nach, der Sternenschlucker lässt ein Trümmerfeld
zurück.

Passive Gegenstände (Schleifstein, Zündspule, Panzerplatte …) gibt es weiter,
aber deutlich seltener. Sie sind der Kitt für einen Bau, nie der Bau.

**Eine Karte betrifft immer eine Waffe**, solange überhaupt eine möglich ist.
Ein reiner Statistik-Bildschirm soll gar nicht erst vorkommen.

## Nachprüfen

```bash
npm run check      # TypeScript
npm run test       # 67 Tests: Waffen, Karten, Risse, Determinismus
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
  game/     Die Simulation — kennt keinen Browser
  render/   Zeichnen, Partikel, Erschütterung, Anzeige
  ui/       Menüs und alle Texte
```

### Die Spiellogik kennt keinen Browser

In `src/game/` steht kein `document`, kein `window`, kein Canvas. Das zahlt
sich dreifach aus: Die Regeln lassen sich ohne Browser testen, `npm run perf`
misst die reine Rechenlast, und ein späteres Verpacken für Steam (Tauri,
Electron) fasst nur `main.ts` an.

Die Importe laufen sternförmig: `state.ts` → `verhalten.ts` → `welt.ts`, und
zurück kommen nur *Typen*. Keine gegenseitigen Importe.

### Verhalten sind Code, Waffen sind Daten

„Inhalte sind Daten" stößt bei Waffen an eine echte Grenze: Ein Bogenhieb *ist*
anderer Code als eine Kugel. Deshalb eine Registratur in `verhalten.ts` mit acht
Feuerfunktionen — eine Waffe, die ein vorhandenes Verhalten wiederverwendet,
bleibt ein reiner Tabelleneintrag in `weapons.ts`.

Die Kartentexte („+6 Schaden · −0,04 s") werden **aus den Stufen-Deltas
erzeugt**, nicht getippt. Bei acht Waffen mal fünf Stufen wären das vierzig
Zeilen, die beim ersten Balancing veralten.

### Risse als Bitmaske

Ein Bit je Waffenplatz, alles in einer einzigen Zahl am Gegner. Bei bis zu 1400
Gegnern wäre ein `Set` pro Stück genau die Sorte Müll, die die Pools an anderer
Stelle vermeiden.

### Gesetzter Zufall

Jeder Zufall läuft über `core/rng.ts`, nie über `Math.random()`. Zwei getrennte
Ströme: `rng` beeinflusst den Lauf, `rngOptik` nur das Aussehen — dafür gibt es
einen eigenen Test. Das bringt reproduzierbare Fehler, deterministische Tests
und einen „Täglichen Lauf" als späteres Wiederkehr-Feature (`tagesSaat()` liegt
bereit).

## Was gemessen ist

`npm run perf` fährt die volle Simulation bei voller Gegnerzahl **mit fünf
bestückten Waffen**, 3000 Ticks, ohne zu zeichnen. Budget: 5 ms pro Tick, bei
60 Hz stehen 16,6 ms zur Verfügung.

| Stand | Mittel | p95 |
|---|---|---|
| 1400 Gegner, eine Waffe | 1,8 ms | 2,4 ms |
| 1400 Gegner, fünf Waffen | 1,8 ms | 2,7 ms |
| 2000 Gegner | 4,5 ms | 5,8 ms |

Das ganze Waffensystem kostet also praktisch nichts. Die Obergrenze steht bei
1400, weil bei 2000 der p95 das Budget reißt.

Beim Messen kam eine Sache heraus, die man nicht vermutet: Das
Auseinanderdrücken der Gegner **spart** Rechenzeit. Wird die Trennkraft
gedeckelt, verklumpen sie, und dann liefert jede Gitterabfrage riesige
Kandidatenlisten — mit Deckel kostete derselbe Zustand 11,7 statt 4,5 ms.

## Was die Screenshots geändert haben

Das Spiel selbst zu starten und anzusehen ist kein Häkchen, sondern hat in zwei
Runden echte Fehler gefunden, die keine Zahl gezeigt hätte:

- **Die ersten Sekunden waren tot** — vom Spawnring braucht ein Gegner zehn
  Sekunden. Jetzt gibt es eine Startwelle auf halbem Weg.
- **Alles war zu klein** — die Kamera steht jetzt näher dran.
- **Der Spieler verschwand im Getümmel**, zweimal: erst ging er in der Masse
  unter, dann fiel auf, dass er beim Blinken gar nicht gezeichnet wurde.
- **Gleichfarbige Gegner verschmolzen zur Fläche** — jetzt trennt eine dunkle
  Kante jeden Körper.
- **Mit fünf Waffen war das Feld grau.** Der Trefferblitz ersetzte die
  Gegnerfarbe, und bei fünf ununterbrochen feuernden Waffen blitzt eben alles
  dauernd. Jetzt überlagert er, statt zu ersetzen.
- **Das Feld ertrank in XP-Kristallen.** Ab 200 Stück wird der Wert in den
  nächstgelegenen Kristall eingerechnet — es geht keine Erfahrung verloren, sie
  sammelt sich nur in dickeren Brocken.

## Was noch fehlt

- **Ton.** Kein einziger. In diesem Genre fehlt damit ein guter Teil der Wucht.
- **Ein Ende.** Der Lauf hört auf, wenn man stirbt — sonst nie. Und hier steckt
  die wichtigste offene Frage: Ein Bau mit fünf voll ausgebauten Waffen ist
  gattungsgemäß übermächtig; gemessen überlebt eine Figur, die sich *gar nicht
  bewegt*, damit zehn Minuten. Die Antwort des Genres darauf ist ein Zeitlimit
  oder ein Endgegner, nicht schwächere Waffen.
- **Zwischenbilder.** Bei 144 Hz ist eine leichte Unruhe sichtbar, weil zwischen
  zwei Logikschritten nicht interpoliert wird.

## Bevor daraus etwas Verkäufliches wird

**Dieses Repo ist öffentlich.** Für einen Prototyp egal. Ein Spiel, das Geld
kosten soll, gehört in ein eigenes, privates Repo — sonst kann jeder den
Quelltext übersetzen und weitergeben. `game/` ist deshalb ein in sich
geschlossenes Projekt ohne Verbindung zum Sniper-Code daneben: Der Umzug ist ein
`git subtree split` und kein Umbau.

Der Steam-Weg wäre danach 100 USD pro Titel (rückvergütet ab 1.000 USD Umsatz),
30 % Anteil für Valve, 30 Tage Sperrfrist nach Zahlung und eine mindestens zwei
Wochen vorher öffentliche Store-Seite — realistisch vier bis sechs Wochen
Formalitäten.
