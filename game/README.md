# Scherbenfeld

Ein Survivor-like als Prototyp, in der Richtung von **Vampire Survivors** und
**Brotato** — mit einer eigenen Regel, die kein anderes Spiel hat.

Man bewegt sich, geschossen wird von allein, Gegner kommen in Wellen,
XP-Kristalle bringen Aufwertungen. Der Reiz entsteht aus der *Kombination*
mehrerer Waffen, nicht daraus, dass eine Zahl steigt.

Jeder Lauf startet bei null — es gibt keine dauerhaften Aufwertungen. Was man
freischaltet, sind **Charaktere**: andere Spielweisen, keine höheren Zahlen.

Keine Laufzeit-Abhängigkeiten: TypeScript, Canvas 2D, sonst nichts.

## Losspielen

```bash
npm install
npm run dev        # http://localhost:5173
```

Auf dem Titelbild wählt man mit A/D den Charakter und startet mit Leertaste.
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

### Verschmelzungen

Stehen **beide** Ausgangswaffen auf Maxstufe, kann eine Fusionskarte kommen.
Sie nimmt beide weg und setzt eine neue an ihre Stelle — ein Platz wird frei.

| Fusion | Aus | Was sie tut |
|---|---|---|
| **Gewitterkern** | Sternenschlucker + Kettenblitz | Loch, das alles Gefangene unter Strom setzt |
| **Scherbenkranz** | Klinge + Trabanten | Klingen kreisen, jede Umdrehung schlägt rundum |
| **Zerlegestrahl** | Prismastrahl + Bazooka | Strahl, der an jedem Getroffenen detoniert |
| **Schwarmnadeln** | Kurzbogen + Splitterwerfer | Nadeln, die sich bei jedem Kill teilen |
| **Kollaps** | Bazooka + Sternenschlucker | Granate, die erst zusammenzieht, dann detoniert |
| **Bogenlicht** | Prismastrahl + Kettenblitz | Strahl, der sich bricht und weiterspringt |

Vier Stufen mit kräftigen Schritten und eine eigene Vollendung — damit gibt es
auch bei Spielerstufe 40 noch etwas zu ziehen. Genau da war der Lauf vorher zu
Ende, was das Entscheiden angeht. Fusionen lassen sich nicht weiter verschmelzen
und kommen kein zweites Mal, wenn das Ergebnis schon im Gürtel liegt.

Kurzfristig kostet eine Fusion **einen Riss** — zwei Waffen werden zu einer. Der
frei gewordene Platz nimmt dafür etwas Neues auf. Eine Abwägung, kein Geschenk.

## Bosse

Alle 90 Sekunden, ab 1:30, mitten im Getümmel — nicht in einer leeren Arena.

Bosse laufen im **normalen Gegner-Pool** mit und sind damit rissbar und
zersplitterbar wie alles andere. Auch der dickste Gegner im Spiel fällt
schneller, wenn drei verschiedene Waffen ihn aufreißen: bessere Werbung für die
Kernregel gibt es nicht.

Vier Angriffe, **jeder mit Vorwarnung** — Speichenfeuer, Sturmangriff,
Schockringe, Bruchruf. Ein Boss ohne Telegraf ist nicht schwer, sondern unfair;
man verliert, ohne zu verstehen warum.

Drei Arten, und **Phase zwei ändert das Muster, nicht die Zahlen**: Der Wächter
feuert seine Speichen im Gegenlauf, sodass die Lücken wandern. Der Kolossus
wechselt das Angriffsbild. Der Zerbrecher hat alle vier.

Wer einen Boss legt, bekommt sofort eine Karte mit deutlich besseren
Seltenheiten — zusätzlich zum normalen Aufstieg.

## Charaktere statt dauerhafter Aufwertungen

Jeder Lauf startet bei null. **Es gibt keine dauerhaften Aufwertungen**, und das
ist Absicht: Eine Bestenliste, in der man sich Werte erspielen kann, misst nur
noch, wer am längsten gespielt hat.

Freigeschaltet wird stattdessen der **Zugang zu einem anderen Spielstil**.
Charaktere sind Seitwärtsbewegungen, keine Stufenleiter — jeder hat einen echten
Vorteil *und* einen echten Nachteil.

| Charakter | Dafür | Dagegen | Freigeschaltet durch |
|---|---|---|---|
| **Splitter** | — | — | von Anfang an |
| **Schleiferin** | startet mit der Klinge, Nahkills stapeln Schaden | −25 Leben | 500 Gegner in einem Lauf |
| **Sammler** | doppelter Einzug, +60 % Erfahrung | −30 % Schaden | Stufe 25 in einem Lauf |
| **Riss** | 3 s ohne Treffer: zersplittert mit *zwei* Waffen | nur 60 Leben | 250 Gegner zersplittern |
| **Koloss** | 220 Leben, verletzt bei Berührung | −25 % Tempo, 4 Plätze | 5 Minuten überleben |
| **Prismatikerin** | startet mit einer Legendären auf Stufe 3 | nur 3 Plätze | eine Waffe vollenden |

Der **Punkte-Faktor** hält die schwereren konkurrenzfähig:

```
Punkte = Sekunden × 10 + Kills + Stufe × 50 + Zersplittert × 2 + Bosse × 500
       × Charakter-Faktor
```

Gespeichert wird über `localStorage` genau zweierlei: welche Charaktere offen
sind und der beste Punktestand. Keine Werte, keine Rechenkraft, nichts, was
einen späteren Lauf leichter macht. Ein Test hält das fest, weil diese Regel
beim Balancing als Erstes aufweicht.

Am Ende zeigt ein Balkendiagramm, **woran die Gegner gestorben sind** — Waffe
für Waffe, mit einem eigenen Balken für die Scherben. Man soll sehen, wie viel
die Kernregel wirklich beiträgt.

## Die Oberfläche aus Glas

Das Spiel heißt Scherbenfeld, die Gegner sind Glas, die Kernregel heißt Risse —
dann soll die Oberfläche auch aus Glas sein und nicht aus abgerundeten
Rechtecken. `render/glas.ts` liefert vier Werkzeuge, alles Canvas-Pfade:
kantige Scherbenplatten mit abgeschlagener Ecke, Bruchlinien, angeschrägte
Balken und einen Sprung über den ganzen Bildschirm.

Angewendet auf die Levelup-Karten (jede um ein bis zwei Grad anders geneigt,
die Seltenheitsfarbe läuft **in den Bruchlinien** statt in einem gleichmäßigen
Rahmen), auf Lebens- und Bossleiste, auf den Titel (von einem Sprung geteilt)
und auf den Todesbildschirm, der von der Stelle des Todes aus zerspringt.

## Nachprüfen

```bash
npm run check      # TypeScript
npm run test       # 102 Tests: Waffen, Karten, Risse, Bosse, Charaktere, Determinismus
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

### Fünf Plätze, acht Bits

`platz` ist zugleich der Index im Gürtel **und** das Bit für die Risse. Beim
Verschmelzen fallen zwei Einträge weg und einer kommt hinzu — würde der Platz
aus der Array-Länge kommen, bekämen danach zwei Waffen dasselbe Bit, und die
Kernregel wäre im Spiel unsichtbar ausgehebelt. Deshalb: **kleinster freier
Index**, und er bleibt an der Waffe kleben. Drei reservierte Plätze dahinter
gehören den Scherben, dem Geisterriss und den Dornen des Kolosses — daher acht
Bits bei fünf Waffen.

## Was gemessen ist

`npm run perf` fährt die volle Simulation bei voller Gegnerzahl **mit fünf
bestückten Waffen**, 3000 Ticks, ohne zu zeichnen. Budget: 5 ms pro Tick, bei
60 Hz stehen 16,6 ms zur Verfügung.

| Stand | Mittel | p95 |
|---|---|---|
| 1400 Gegner, eine Waffe | 1,8 ms | 2,4 ms |
| 1400 Gegner, fünf Waffen | 1,8 ms | 2,7 ms |
| 1400 Gegner, fünf Waffen **und dauernd ein Boss** | 1,6 ms | 2,5 ms |
| 2000 Gegner | 4,5 ms | 5,8 ms |

Das ganze Waffensystem kostet also praktisch nichts, Bosse ebenso wenig. Die
Obergrenze steht bei 1400, weil bei 2000 der p95 das Budget reißt.

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

Und in der dritten Runde, mit Bossen und Auswertung:

- **Die Auswertung sagte „Platz 4" statt „Bazooka".** `starteLauf` hat die
  Plätze beschriftet und die Statistik danach ausgetauscht — die Namen waren
  sofort wieder weg. Genau die Frage, für die der Bildschirm da ist, blieb
  unbeantwortet. Kein Test hätte das gezeigt; jetzt tut es einer.
- **Der Todesbildschirm war unlesbar.** Der Schleier ließ das Getümmel
  durchscheinen, und das HUD zeichnete quer über die Zahlen.
- **Der Boss fiel bei vollem Feld lautlos aus.** Steht der Gegner-Pool am
  Deckel, liefert er keinen Platz mehr — und die Bossnummer zählte trotzdem
  weiter. Die Welle war damit übersprungen, ausgerechnet in der späten Phase.
- **Dieselbe Fusion lag zweimal im Gürtel.** Wer die Ausgangswaffen später neu
  zieht und wieder ausreizt, bekam eine zweite Kopie.

Zwei Sachen hat erst die Messung gezeigt, nicht das Bild:

- **Bosse liefen auf der Schwarmkurve mit.** Die ist quadratisch und ergibt in
  der zehnten Minute Faktor 71 — gemessen wurden Bosskämpfe von über drei
  Minuten, und weil die nächste Welle wartet, kamen statt sieben Bossen nur
  drei. Bosse haben jetzt ihre eigene, viel flachere Kurve.
- **Ein Splitter nahm dem Boss 60 % seiner Leiste.** Zwei davon, und er war
  weg, Phase zwei praktisch nie zu sehen. Beim Boss sind es jetzt 15 % — dafür
  darf er als Einziger **mehrfach** zerspringen, wenn drei Waffen ihn erneut
  aufreißen. Der gemischte Bau wird damit über den ganzen Kampf belohnt statt
  einmal am Anfang.

## Was noch fehlt

- **Ton.** Kein einziger. In diesem Genre fehlt damit ein guter Teil der Wucht.
- **Ein Ende.** Der Lauf hört auf, wenn man stirbt — sonst nie. Bosse alle 90
  Sekunden geben ihm jetzt einen Takt, aber kein Ziel. Ein Endgegner oder ein
  Zeitlimit fehlt weiterhin.
- **Bossbalance.** Gemessen über fünf Läufe schwankt ein Bosskampf zwischen 4
  und 100 Sekunden — je nachdem, ob der Bau Einzelziel-Schaden hat. Dass ein
  Flächenbau sich am Boss schwertut, ist gewollt; diese Spanne ist zu groß. Und
  ob sich der Boss *schwer und fair zugleich* anfühlt, entscheidet sich am
  Gamepad, nicht in einer Tabelle.
- **Eine echte Bestenliste.** Der Punktestand steht, gespeichert wird lokal.
  Online daraus zu machen ist ein Datenfeld, kein Umbau.
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
