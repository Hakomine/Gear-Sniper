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
WASD oder Pfeiltasten bewegen, Gamepad geht auch. **Leertaste stößt** — ein
kurzer Satz, bei dem man unverwundbar ist, mit 2,5 s Abklingzeit. **Escape**
hält an. Beim Levelup wählt man mit A/D und bestätigt mit Leertaste — oder
drückt gleich 1, 2 oder 3.

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

Sechs Plätze, **zwanzig Waffen**, sechs Fusionen, vier Seltenheiten.

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

Passive Gegenstände gibt es weiter, aber deutlich seltener — und sie sind
inzwischen **Regeln statt Prozente**. Drei bleiben schlichte Werte (Leben,
Tempo, Heilung); zwölf ändern, *wie* etwas funktioniert: Risse halten länger,
jeder dritte Riss springt weiter, Zersplitterte lassen Scherben liegen,
kritische Treffer reißen zusätzlich auf, Stillstehen lädt einen Schild, ein
Treffer lässt alles ringsum zerspringen. Fast alle hängen an der Kernregel —
ein Gegenstand, der den eigenen Bau umbaut, ist mehr wert als einer, der
irgendein Nebensystem verbessert.

**Eine Karte betrifft immer eine Waffe**, solange überhaupt eine möglich ist.
Ein reiner Statistik-Bildschirm soll gar nicht erst vorkommen.

### Zwölf, die je etwas Eigenes tun

Acht plus sechs Fusionen war für dieses Genre wenig, und die Hälfte davon waren
Varianten von „fliegt und trifft". Diese zwölf machen jeweils etwas, das keine
andere tut — und die meisten hängen an der Riss-Regel, statt danebenzustehen.
Ein Test hält fest, dass sich **keine zwei Waffen ein Verhalten teilen**.

| Waffe | Seltenheit | Was sie tut |
|---|---|---|
| **Schleifband** | gewöhnlich | zieht eine schneidende Spur hinter dir her |
| **Stimmgabel** | gewöhnlich | Schallwelle ringsum — trifft härter, was schneller läuft |
| **Fadenkreuz** | selten | bohrt am zähesten Gegner und lädt sich dabei auf |
| **Spiegelscherbe** | selten | wirft feindliche Geschosse zurück, schneller und schärfer |
| **Frostkeil** | selten | vereist — und Vereistes zerspringt mit **zwei** Waffen statt drei |
| **Ankerhaken** | selten | zieht den *entferntesten* Gegner mitten in deinen Bau |
| **Bohrkopf** | episch | bleibt stecken und reißt seinen Riss immer wieder neu auf |
| **Glockenturm** | episch | ein Schlag setzt bei allem im Bild einen Riss |
| **Saatgut** | episch | träge Knospe, die erst am Ende ihres Wegs aufgeht |
| **Schwarzband** | episch | schneidet alles zwischen dem nächsten und dem fernsten Gegner |
| **Kaleidoskop** | legendär | löst eine andere deiner Waffen ein zweites Mal aus |
| **Sanduhr** | legendär | alles im Umkreis läuft rückwärts — auch feindliche Geschosse |

Drei davon greifen direkt in die Kernregel: Der **Frostkeil** senkt die Schwelle,
statt Schaden zu erhöhen. Der **Glockenturm** allein tötet nichts — in einem Bau
mit zwei weiteren Waffen lässt er das halbe Bild zerspringen. Und das
**Kaleidoskop** hat als einzige Waffe *keinen eigenen Schaden*: Ihr Wert hängt
ausschließlich davon ab, was sonst noch im Gürtel liegt.

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

## Die Bildsprache: massiv

Nach der vierten Runde kam die Rückmeldung „das Design gefällt mir überhaupt
nicht" und „das Spiel ist unübersichtlich". Beides stimmte, und beides hatte
**eine** Ursache: Die Bruchlinien liefen quer durch die Schrift. Auf der Tür
„Ruhe" war „Nichts wird schwerer" durchgestrichen, der Titel hatte einen Strich
mitten durchs Wort. Ein Strich durch Text heißt überall *gelöscht* — das Auge
kann gar nicht anders, als das als kaputt zu lesen.

Aus drei vorgelegten Richtungen fiel die Wahl auf **massiv**:

| Regel | Vorher | Jetzt |
|---|---|---|
| Spielfeld | fast schwarz | **heller als die Figuren** (`#2a2f3e`) |
| Gegner | gefüllt, dünne Kante in Grundfarbe | gefüllt, **3 px dunkle Kontur**, Schlagschatten |
| Karten | durchscheinende Umrisse mit Linien im Text | **massive Platten** mit Kante, Schatten, Akzentbalken oben |
| Bruchlinien | quer über die Fläche | nur im **Kopfstreifen**, nie in der Textfläche |
| Spieler | kleiner Punkt unter tausend | größer, cremig, eigene Kontur — als Einziger rund |

Der Griff dahinter ist die Umkehr: Ein mittelheller Grund trägt gefüllte Körper
mit dunkler Kontur, und jede Silhouette schneidet sich von selbst frei. Bei
tausend Gegnern bleiben es tausend Gegner statt eines Teppichs.

Die Charakterauswahl zeigt jetzt ein **Wappen** statt nur Text: denselben
Körper, den man gleich steuert, plus ein Zeichen, das die Mechanik andeutet —
der Bogenhieb der Schleiferin, die Dornen des Kolosses, der gebrochene Strahl
der Prismatikerin.

## Die Minikarte

Oben rechts, und sie zeigt **vier** Dinge — mehr wäre wieder Rauschen:

- **Du**, mit Blickrichtung
- **Der Boss** als Keil, der in seine Richtung zeigt, auch weit außerhalb
- **Offene Schreine** als Bernsteinraute
- **Das Getümmel** als Wolke, nicht als 1400 Punkte Konfetti

Was außerhalb der Reichweite liegt, klemmt am Rand. Ein Boss, den man nicht
sieht, ist die wichtigste Information von allen.

## Neun Gegner, neun Köpfe

Lange Zeit gab es drei Gegnerarten, und alle drei liefen durch dieselben acht
Zeilen: Richtung zum Spieler, Tempo drauf, fertig. Der „Elite" war ein Sechseck
mit mehr Trefferpunkten. Die Waffen waren verschieden — alles, worauf sie
zielten, war identisch. Genau daran lag es, dass sich Minute zehn anfühlte wie
Minute eins.

Die Arten liegen als Daten in `enemies.ts`, ihr Verhalten als Registratur in
`gegnerVerhalten.ts` — dieselbe Aufteilung wie bei Waffen und Feuerarten.

| Art | Verhalten |
|---|---|
| **Splitter** | geradeaus, die Grundmasse |
| **Brocken** | langsam, zäh — der Amboss, an dem man Risse setzt |
| **Kantiger** | geradeaus, schwer wegzuschubsen |
| **Schwärmer** | kreist auf Abstand und schließt in Wellen |
| **Stürmer** | hält an, kündigt eine Bahn an, zieht sie durch |
| **Speier** | bleibt weit weg und schießt |
| **Teiler** | zerfällt beim Tod in zwei Bruchstücke |
| **Kitt** | **schließt Risse bei allen Gegnern um sich herum** |
| **Schildträger** | von vorn fast unverwundbar, dreht sich nur langsam mit |

Zwei tragen den Rest:

Der **Kitt** löscht in seinem Umkreis Risse — also genau das, worauf jeder Bau
beruht. Damit stellt das Spiel zum ersten Mal die Frage *wen zuerst?*.

Der **Speier** dreht die Fluchtrichtung um. Bisher war jede Bewegung ein
Wegrennen; ein Gegner, der auf Distanz bleibt und trifft, ist der erste Grund,
sich in etwas hinein zu bewegen.

Der **Stürmer** hält seine angekündigte Bahn und lenkt nicht nach. Ein Sturm,
der mitzieht, ließe sich nicht ausweichen — dann wäre die Vorwarnung eine Lüge.

## Der Stoß

Leertaste: kurzer Satz in Laufrichtung, dabei unverwundbar, 2,5 s Abklingzeit,
Ring am Spieler. Er setzt **keinen Riss** — bewusst: Der Stoß bleibt reines
Ausweichen und hängt sich nicht an die Kernregel.

Ohne ihn wären Stürmer und Speier nur Ärger. Mit ihm sind sie das, was ein
telegrafierter Angriff sein soll: lesbar, und man kann etwas dagegen tun.

## Etappen, Türen und Schreine

Der Lauf war ein durchgehender Strom ohne eine einzige Pause. Jetzt endet jede
Etappe mit ihrem Boss, das Spiel hält an, und man wählt, **wie** die nächste
aussehen soll. Auf jeder Tür steht Preis *und* Lohn — man sieht die Belohnung,
bevor man bezahlt.

| Tür | Kostet | Bringt |
|---|---|---|
| **Ruhe** | nichts | eine Karte |
| **Gedränge** | doppelter Nachschub | zwei Karten |
| **Gepanzertes Glas** | Gegner +60 % Leben | eine bessere Karte |
| **Zwillinge** | zwei Bosse statt einem | zwei bessere Karten |
| **Dünnhäutig** | doppelter Schaden, dauerhaft | ein Waffenplatz mehr, dauerhaft |
| **Sprödigkeit** | Risse verfallen doppelt so schnell | Zersplitterung trifft doppelt so weit |

„Sprödigkeit" ist die interessanteste: Sie greift die Kernregel an und belohnt
sie zugleich. Wer gemischt gebaut hat, nimmt sie gern; wer auf zwei Waffen
sitzt, kann sie nicht bezahlen.

Dazu **Schreine** im Feld — zwei bis drei je Etappe, am Bildrand angezeigt:

| Schrein | Kostet | Bringt |
|---|---|---|
| **Amboss** | drei Sekunden stillstehen, mitten im Getümmel | eine Karte |
| **Gierscherbe** | die Etappe wird 25 % schwerer | sofort eine Stufe |
| **Bruchmal** | ruft sofort einen zweiten Boss | eine bessere Karte |

Der Amboss ist der beste der drei, weil Stillstehen hier genau das ist, was
einen umbringt — und weil er mit dem Charakter *Riss* kollidiert, dessen
Geisterriss drei Sekunden **ohne Treffer** verlangt.

## Ton — ohne eine einzige Datei

Das Spiel zeichnet sich aus Code. Der Ton entsteht genauso: WebAudio,
Oszillator, Rauschen, Hüllkurve. Kein Sample, keine Lizenzfrage, keine
Ladezeit.

Die Simulation **meldet** nur in einen Ringpuffer (`game/klaenge.ts`),
`main.ts` leert ihn je Bild und `audio/ton.ts` macht daraus Klang. So bleibt
`src/game/` browserfrei — darauf beruhen alle Tests ohne Fenster und
`npm run perf`. Ein Test hält die Grenze fest.

Tonhöhe streut je Auslösung um ±12 %, je Klangart gilt eine Mindestpause, und
höchstens 24 Stimmen laufen gleichzeitig — sonst wird aus fünf Waffen an 1400
Gegnern weißes Rauschen. Der Kristallklang steigt beim Sammeln an.

**M** oder das Pausenmenü schaltet stumm.

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
npm run test       # 195 Tests: Waffen, Karten, Risse, Gegner, Bosse, Etappen, Ton, Determinismus
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
| 1400 Gegner **aus allen neun Arten**, fünf Waffen, ein Boss | 1,5 ms | 2,2 ms |
| dieselbe Mischung, **gewichtet wie im Spiel** | 2,2 ms | 3,8 ms |
| 2000 Gegner | 4,5 ms | 5,8 ms |

Das ganze Waffensystem kostet also praktisch nichts, Bosse ebenso wenig — und
neun Gegnerverhalten statt einem kosten rund zwei Zehntel Millisekunden. Die
Obergrenze steht bei 1400, weil bei 2000 der p95 das Budget reißt.

Die Messung füllt bewusst mit **allen** Arten gemischt. Vorher lief sie nur mit
Splittern und sah von den neuen Verhalten deshalb nichts: keine kreisenden
Schwärmer, keine Vorwarnungen, keine Speier-Geschosse, keine Umkreisabfragen
des Kitts.

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

Und in der vierten Runde, mit Gegnerverhalten, Stoß und Ton:

- **Frisch gespawnte Gegner erbten die Risse ihres Vorgängers.** Der Pool gibt
  gebrauchte Objekte heraus, und `legeGegner` hat die Riss-Felder nie geleert.
  Mal kam ein Gegner mit zwei Rissen zur Welt und zersprang beim ersten
  Treffer, mal trug er das `zersplittert` seines Vorgängers und konnte nie
  wieder zerspringen. Die Kernregel war damit teilweise ein Würfelwurf statt
  eine Folge des eigenen Baus — und das gehört mit zu „alles fühlt sich gleich
  an".
- **`new AudioContext()` riss den ganzen Tick mit.** Im Testbrowser ohne
  Audiogerät flog die Ausnahme aus dem Tick-Callback, und der Lauf fror ein.
  Kein Ton ist ein Schönheitsfehler, ein stehendes Spiel nicht — die Synthese
  ist jetzt gekapselt.
- **Ein sechster Waffenplatz kollidierte mit dem Scherbenplatz.** Die Tür
  „Dünnhäutig" gibt einen Platz dazu; die reservierten Riss-Bits beginnen aber
  direkt hinter `MAX_WAFFEN`. Ohne Grenze hätten eine Waffe und die Scherben
  dasselbe Bit geteilt und die Kernregel wäre still ausgehebelt gewesen.

Und in der fünften Runde, beim Umbau der Bildsprache:

- **Der Schwarmtakt holte jeden verpassten Termin nach.** `naechsterSchwarm +=
  TAKT` statt „ab jetzt": Springt die Spielzeit — beim Vorspulen, beim
  Bruchmal, das eine Bosswelle heranzieht, oder nach einem langen Ruckler —
  kamen dutzende Schwärme in aufeinanderfolgenden Ticks. Gemessen bestanden
  danach **40 % des Feldes aus einer einzigen Gegnerart**, wo die Gewichte drei
  Prozent vorsehen. Das war ein guter Teil des „unübersichtlich".
- **Kitte deckten sich gegenseitig.** Zwei nebeneinander konnten beide nicht
  mehr zerspringen, lebten dadurch deutlich länger als alles andere und häuften
  sich an. Ein Flicker flickt jetzt keinen Flicker.
- **1871 Feindgeschosse gleichzeitig.** Ohne Deckel wurde aus dem
  telegrafierten Schuss des Speiers eine Wand, die man nicht mehr lesen, nur
  noch erleiden kann. Jetzt bei 260 gedeckelt — wer nicht schießen darf, lädt
  einfach weiter.
- **Die Messung maß einen unmöglichen Zustand.** Sie füllte reihum durch alle
  Arten, damit bestand ein Sechstel des Feldes aus Speiern. Jetzt gewichtet sie
  wie das Spiel.
- **Der Kitt war cremefarben** — dieselbe Farbe wie der Spieler, und es gibt ihn
  hundertfach. Das brach genau die Regel, die die eigene Figur auffindbar macht.

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

- **Ein Ende.** Der Lauf hört auf, wenn man stirbt — sonst nie. Etappen und
  Bosse geben ihm einen Takt, aber kein Ziel. Ein Endgegner oder ein Zeitlimit
  fehlt weiterhin.
- **Musik.** Klänge gibt es, einen Soundtrack nicht.
- **Der Todesbildschirm und die Waffenleiste** sind noch in der alten
  Formsprache. Sie funktionieren, aber sie tragen die massiven Platten noch
  nicht durchgehend.
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
