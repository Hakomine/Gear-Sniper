# Scherbenfeld

Ein Survivor-like als Prototyp, in der Richtung von **Vampire Survivors** und
**Brotato** — mit einer eigenen Regel, die kein anderes Spiel hat.

Man bewegt sich, geschossen wird von allein, Gegner kommen in Wellen,
XP-Kristalle bringen Aufwertungen. Der Reiz entsteht aus der *Kombination*
mehrerer Waffen, nicht daraus, dass eine Zahl steigt.

Jeder Lauf startet bei null — es gibt keine dauerhaften Aufwertungen. Was man
freischaltet, sind **Charaktere**: andere Spielweisen, keine höheren Zahlen. Wer
es schwerer will, legt sich vorher **Verhexungen** auf und bekommt dafür mehr
Punkte.

Keine Laufzeit-Abhängigkeiten: TypeScript, Canvas 2D, sonst nichts.

![Drei Runden desselben Weltausschnitts: Farbkonfetti, Neon auf Schwarz,
Tinte auf Papier](docs/vorher-nachher.jpg)

Dreimal dasselbe Spiel, dieselbe Minute, derselbe Bau. Die mittlere Fassung
sollte die erste beheben und hat sie verschlimmert — warum, steht unter [Tinte
auf Papier](#tinte-auf-papier).

## Losspielen

```bash
npm install
npm run dev        # http://localhost:5173
```

Auf dem Titelbild wählt man mit A/D den Charakter und startet mit Leertaste.
**W/S** wechselt in die Verhexungsreihe darunter, wo die Leertaste umschaltet
statt zu starten. **T** startet die Tagesscherbe.

WASD oder Pfeiltasten bewegen, Gamepad geht auch. **Leertaste stößt** — ein
kurzer Satz, bei dem man unverwundbar ist, mit 2,5 s Abklingzeit. **Escape**
hält an. Beim Levelup wählt man mit A/D und bestätigt mit Leertaste — oder
drückt gleich 1, 2 oder 3.

Ein Lauf führt in **sechs Etappen zum Kern** — dem einzigen Gegner, den man nur
mit der Kernregel töten kann. Wer ihn schlägt, gewinnt; wer weiter will, nimmt
**Zerrüttung** auf sich und läuft dieselben sechs Etappen härter noch einmal.

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
| Spielfeld | fast schwarz | **heller als die Figuren** (`#2a2f3e`) — bis Runde 7, siehe unten |
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

Die Sprache geht durch bis in die letzte Ecke: Uhr, Stufe, Kills, Minikarte und
Waffenkacheln sitzen auf denselben Platten mit Akzentbalken; Lebens- und
Bossleiste haben Kontur, Schatten und einen hellen Kamm auf der Füllung;
Schadenszahlen bekommen einen dunklen Umriss, damit sie sich im Getümmel nicht
gegenseitig auslöschen; Zonen füllen dunkel statt hell, weil das Feld jetzt
hell ist. Der Todesbildschirm besteht aus drei Platten — Punktetafel oben, was
passiert ist links, woran sie gestorben sind rechts — und der Sprung im Glas
läuft **hinter** ihnen durch, nicht über den Text.

## Tinte auf Papier

Zweimal hintereinander kam dieselbe Rückmeldung, und beim zweiten Mal war sie
schärfer:

> „Das Game ist schon cool, aber es sieht mir immer noch so aus, als wäre das
> so wie KI gemacht."

und nach der Runde, die genau das beheben sollte:

> „Er sieht jetzt **noch mehr** so aus, als wär das mit KI gemacht, weil das
> sieht alles so clean aus. Guck dir mal an, wie das bei den anderen Games so
> ist."

Das ist kein Geschmacksurteil, das man wegdiskutieren kann — und es ließ sich
belegen. Die dokumentierte Handschrift maschinell erzeugter Gestaltung ist
wörtlich:

> „neon-on-dark (cyan/violet) with **glowing card borders** and animated
> accent-glow backgrounds"
> — [SmoothUI, *AI Design Slop*](https://smoothui.dev/blog/ai-design-slop)

Das war Punkt für Punkt das, was in der Runde davor hier eingebaut worden war.
Ich hatte diese Richtung selbst vorgeschlagen und als Empfehlung markiert, ohne
zu erkennen, dass ich damit die statistische Voreinstellung anbiete. Mehr Mühe
in dieselbe Richtung machte es schlimmer, nicht besser.

Die Gegenrichtung ist genauso belegt: Was handgemacht *wirkt*, kommt aus
„irregular lines, uneven edges, visible materials", und das sei „difficult to
replicate with **procedural or vector-based approaches**"
([VSQUAD](https://vsquad.art/blog/mastering-indie-game-art-styles-a-developers-guide)).
Genau da lag das Problem: Jedes Sechseck kam aus `cos(i * PI / 3)`, jeder
Strich war exakt drei Punkte breit, jede Fläche eine einfarbige Füllung. Es sah
maschinell aus, **weil es maschinell war**.

Und die Spiele, mit denen dieses verglichen wird, machen alle das Gegenteil:
Vampire Survivors wird als „charming, **scruffy**" beschrieben, Brotato als
comic-artig wie Binding of Isaac
([videochums](https://videochums.com/article/brotato-vs-vampire-survivors)).
Keines davon ist clean. Keines davon leuchtet. Alle haben ein Gesicht.

Also: **Druck.** Ein Verfahren, das nur Tinte kennt und Papier — und das
deshalb gar nicht leuchten *kann*.

### Vier Werte statt dreizehn

Die Palette sagt ab jetzt etwas. Das ist der Unterschied zwischen einer
Farbauswahl und einem Stil:

| Wert | Bedeutung |
|---|---|
| **Tinte** (warmes Schwarz) | die Welt, die Gegner, alles Feste |
| **Papier** (gealtertes Weiß) | der Bruch, das Fehlende — *und der Spieler* |
| **Zinnober** | es kann dir wehtun |
| **Ocker** | es ist gut für dich |

Der Spieler ist damit ein **weißes Loch in einer schwarzen Masse**. Bei 1400
Gegnern ist das die stärkste Lesbarkeit, die es gibt, und sie kostet keine
einzige zusätzliche Farbe. Reines `#000` gibt es nicht: Ein Schwarz mit einem
Rest Braun liest sich als Farbe, die einmal flüssig war; reines Schwarz liest
das Auge sofort als Bildschirm.

Möglich war der Wechsel, weil die Simulation die Palette nur über **Namen**
abgreift (`FARBEN.gefahr`, nie ein Hex-Wert). Er ging durch das ganze Spiel,
ohne dass in `src/game/` eine Regel fiel.

### Ausgebrochene Kanten

Der Kern der Sache. Jeder Eckpunkt rutscht aus seiner Sollposition — radial und
quer, abgeleitet aus der `id` des Gegners. Kein Sechseck ist mehr wie das
andere, aber jedes bleibt sich über alle Bilder treu; wäre der Versatz je Bild
neu, flackerte das Feld, und aus „handgeschnitten" würde „kaputt".

`ctx.rect` und `ctx.arc` sind dabei gefallen: Ein Rechteck und ein Kreisbogen
lassen sich nicht verwackeln, und ein exaktes Rechteck zwischen lauter
geschnittenen Formen fällt sofort auf. Der Halbmond des Schildträgers ist jetzt
ein Polygonzug aus neun Stücken — aus der Ferne derselbe Bogen, aus der Nähe
ein Schnitt.

Die Kosten wären messbar gewesen: über zwanzigtausend Abfragen je Bild. Sie
kommen deshalb aus einer Tabelle mit 256 Werten statt aus `Math.sin`.

### Was ein Druck kann und ein Vektorbild nicht

`render/papier.ts` liefert vier Dinge:

- **Korn.** Papier ist nie glatt. Eine gekachelte Nebenleinwand, ein
  Füllaufruf je Bild statt zwölftausend Punkten. Die Körner sind *dunkler* als
  das Papier — helles Korn auf hellem Grund wäre Bildrauschen, also ein Fehler.
- **Flecken.** Papier ist nie gleichmäßig. An Weltkoordinaten verankert: Man
  sieht sie nur, wenn man sich bewegt, und dann sagen sie „du bist woanders"
  statt „hier fliegt was".
- **Schraffur.** Im Hochdruck gibt es keinen Verlauf — die Walze trägt Farbe
  auf oder sie tut es nicht. Wer dunkler will, schneidet enger. Nur für Große:
  Zwei Striche in einem Splitter von neun Punkten Radius wären kein Schnitt,
  sondern Dreck.
- **Kerben.** Ein Riss ist ab jetzt *fehlende Tinte*, kein hellblauer Strich
  darauf. Damit sieht ein gerissener Gegner beschädigt aus statt bemalt — und
  das, wonach das Spiel benannt ist, ist endlich auch das, was man zuerst
  sieht.

Die ganze Glut-Schicht der Runde davor ist **ersatzlos gelöscht**. Wo etwas
strahlen soll, strahlt es so, wie ein Holzschnitt strahlt: mit Schnitten nach
außen.

### Fehldruck

Der billigste Handgriff der Runde und einer der wirksamsten: Die beiden
Druckfarben liegen **ein bis anderthalb Punkte neben** der Tinte. Konstant je
Farbe, nicht je Objekt — eine Presse ist einmal falsch justiert und dann für
den ganzen Bogen.

Nichts sagt „das hat eine Maschine gedruckt, die ein Mensch bedient hat" so
deutlich wie ein Versatz, der nicht null ist. Und umgekehrt ist perfekte
Passgenauigkeit über alle Farben hinweg genau das, was ein Bild digital
aussehen lässt.

### Augen

Bis hierher war Scherbenfeld eine Simulation von Vielecken. Jedes Spiel, mit
dem es verglichen wird, hat an dieser Stelle etwas: Isaac hat Gesichter,
Downwell hat Augen, Brotato hat eine Kartoffel.

Es kostet zwei Kreise. Brocken, Schildträger, Speier, Teiler, Kitt und **jeder
Boss** sehen einen jetzt an. Die Pupille folgt dem Spieler, beim Treffer kneift
das Lid zu, und trägt der Gegner Risse, springt die Pupille — die Kernregel
steht damit auch im Gesicht.

Der Pulk bleibt bewusst anonym, und *genau deshalb* wirkt das Große lebendig:
Was einen ansieht, ist jemand; was einen nicht ansieht, ist Masse. Bekäme der
Splitter ein Auge, säßen bei vollem Feld tausend davon im Bild, und aus
Charakter würde Rauschen.

### Der Titel wird von einem gesprungenen Druckstock gedruckt

Das ist das Bild, das später auf die Steam-Seite kommt. Zwei Fassungen davor
sind gescheitert: Die erste hat das Wort waagerecht durchgeschnitten — gemeint
als Sprung im Glas, gelesen als Durchstreichung, und ein Strich durch Text
heißt überall *ungültig*. Die zweite war schlicht gesetzte Schrift mit
Versatzschatten, also das, was jede Vorlage macht.

Jetzt tut das Wort, was das Spiel tut: Es zerbricht. Der Stock ist gesprungen,
die Bänder sitzen nicht mehr genau, und quer durch die Buchstaben laufen
Kerben, in denen keine Tinte liegt. Die Kerben werden mit `destination-out`
gezeichnet, nehmen die Tinte also *weg* — das ist der Unterschied zwischen
„durchgestrichen" und „gebrochen".

Es bleiben echte Buchstabenformen aus der mitgelieferten Schrift. Zwölf von
Hand gebaute Glyphen wären Wochen Arbeit und sähen schlechter aus.

### Und was dabei zerbrochen wäre, hätte kein Test gegriffen

Mit zwei Druckfarben fielen **vier der fünf Zeichen auf Zinnober zusammen**.
Ein Test hat es sofort gemeldet: `expected 2 to be 5`. Ein Zunder wäre von
einem Frostmal nicht mehr zu unterscheiden gewesen — und wer nicht sieht,
*welches* Zeichen ein Gegner trägt, kann nicht darauf reagieren. Dann ist die
Mechanik nur noch „der da ist zäher".

Der Ausweg ist der, den ein Stecher nimmt, der nur eine Farbe hat: **Er
wechselt den Strich.** Durchgezogen, gestrichelt, gepunktet, lang-kurz,
kurz-lang. Die Farbe sagt weiterhin etwas — nur nicht mehr *welches* Zeichen,
sondern ob man davon etwas hat.

## Wie es sich anfühlt

Grafik war die eine Hälfte der Rückmeldung; „wie es sich spielen lässt" die
andere. Vier Eingriffe, alle klein im Code und groß in der Hand:

**Hitstop.** Der größte Hebel fürs Gefühl und fast umsonst: `laufendTick`
rechnet ohnehin schon `sdt = dt * s.zeitskala * …`. Neu ist `s.stopRest` —
solange es läuft, ist `sdt` null, `aktualisiereOptik` läuft aber weiter. Das
Bild bleibt lebendig, die Welt steht still.

| Moment | Dauer |
|---|---|
| Zersplitterung | 55 ms |
| Zersplitterung an einem Boss | 90 ms |
| Schalenbruch am Kern | 120 ms |
| Treffer am Spieler | 70 ms |
| Die Kernscherbe zerspringt | 140 ms |

Gedeckelt bei 160 ms, damit eine Kettenreaktion — und die ist bei dieser
Kernregel der Normalfall — das Spiel nicht einfriert. Zwei Splitter im selben
Tick verlängern nichts; der längere gewinnt.

**Kamera mit Charakter.** Sie zielt ein Stück in Laufrichtung **voraus**, damit
man sieht, wohin man rennt, statt hinterherzuschauen. Ein abklingender **Kick**
schiebt sie vom Einschlag weg. Und ein winziger **Zoomstoß** bei
Zersplitterung, Schalenbruch und Bossauftritt gibt dem Bild einen Atemzug —
bewusst nur ein paar Prozent, alles darüber liest das Auge als Ruckeln.

**Trägheit.** Die Figur schrieb ihre Position bisher direkt aus der
Tastenrichtung: im ersten Bild volles Tempo, beim Loslassen sofortiger Halt.
Maximal präzise, und es fühlt sich an wie ein Mauszeiger — man schiebt einen
Punkt herum, statt jemanden zu bewegen. Jetzt rampt eine eigene Geschwindigkeit
in rund 70 ms auf das Ziel und rollt beim Loslassen aus. Gemessen an dem, was
das Spiel verlangt, ist das eine Größenordnung unter jeder Vorwarnung: Der
Stürmer kündigt seine Bahn 0,7 Sekunden vorher an, der Boss 0,8 bis 1,2. Der
**Stoß** ist davon ganz ausgenommen und überschreibt sie vollständig — ein
Ausweichmanöver darf nie daran scheitern, dass die Figur noch anfährt.

**Tod mit Richtung.** Scherben fliegen jetzt *vom tödlichen Treffer weg* statt
gleichmäßig ringsum, und Funken sprühen in Flugrichtung des Geschosses statt
kugelförmig. Der Kill ist der häufigste Moment im Spiel — er trägt das Gefühl.

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

## Der Kern — ein Lauf hat ein Ziel

Bis zur fünften Runde hörte ein Lauf auf, wenn man starb, und sonst nie.
Etappen und Bosse gaben ihm einen Takt, aber kein Ziel — und **eine Bestenliste
ohne Ziel misst Sitzfleisch**: Die höchste Punktzahl gehört dem, der am
längsten stillhalten konnte. Genau der Fehler, den das Spiel bei den
dauerhaften Aufwertungen bewusst vermeidet.

Nach der **sechsten Etappe** steht deshalb ein Tor mit zwei Seiten:

| Tür | Kostet | Bringt |
|---|---|---|
| **Zum Kern** | hier endet der Lauf — so oder so | den letzten Gegner, ein Sieg zählt 4000 Punkte |
| **Tiefer ins Feld** | eine Stufe Zerrüttung | zwei bessere Karten und die Hälfte mehr auf *alle* Punkte |

Der Ausstieg ist eine Entscheidung, kein Zeitablauf. Und weil die Zerrüttung am
Ende auf alles multipliziert, ist keine der beiden Seiten die feige: Wer zweimal
vorbeigeht und dann fällt, kann mehr stehen haben als jemand, der beim ersten
Mal gewinnt.

### Warum der Kern anders ist als jeder andere Boss

**Gewöhnlicher Schaden kratzt ihn kaum. Nur Zersplitterung tötet ihn.**

- Er nimmt **ein Zehntel** des normalen Schadens.
- Jede **Zersplitterung** nimmt ihm **12 %** seiner vollen Trefferpunkte.
- Alle sechs Sekunden **kittet er sich selbst**: alle Risse weg, mit Vorwarnung
  und einer eigenen Uhr unter seiner Leiste.

Der Endkampf ist damit eine Prüfung auf genau die Regel, die das Spiel die ganze
Zeit lehrt. Die zehn Prozent sind die Fairness-Klausel: Ein Bau ohne Mischung
schafft ihn auch, nur langsam — es gibt keine Sackgasse, in der ein Lauf
unlösbar wird.

**Drei Schalen** bei 75, 50 und 25 %. Jede bricht mit einem
Unverwundbarkeitsfenster, einem Ring aus dreißig Gegnern und einem Angriff mehr
— darunter die **Bruchwelle**, der einzige Angriff im Spiel, dem man nicht
ausweicht: ein wachsender Ring mit *einer* Lücke, durch die man hindurch muss.

Wer ihn legt, sieht **VOLLENDET** statt ZERBROCHEN, in Gold statt in Rot, und
schaltet die **Kernscherbe** frei.

## Zeichen — fünfundvierzig Begegnungen aus neun Gegnern

Der billigste Weg zu Vielfalt, den dieses Genre kennt, ist Risk of Rain 2s
Elite-System: nicht neue Gegner, sondern **Aufsätze auf alle vorhandenen**.
Wichtiger als die Zahl ist, *was* ein Zeichen ändert — das **räumliche
Verhältnis** zum Spieler, nicht die Werte. Ein Gegner mit doppelten
Trefferpunkten ist derselbe Gegner in länger.

| Zeichen | Was es tut | Gegenmittel |
|---|---|---|
| **Zunder** | zieht eine brennende Spur hinter sich her | nicht hinterherlaufen |
| **Frostmal** | platzt beim Tod zu einem Eisring, der *dich* bremst | woanders töten, oder stoßen |
| **Klammer** | seine Risse verfallen **dreimal so schnell** | am Stück aufreißen statt anknabbern |
| **Echo** | zerfällt beim Tod in zwei blanke Kopien | Fläche, oder das Rinnsal hinnehmen |
| **Zieher** | **zieht den Spieler zu sich** | stoßen, oder ihn zuerst wegräumen |

Die **Klammer** ist die wichtigste: Sie greift die Kernregel direkt an. Ein Bau,
der Risse langsam ansammelt, kommt an ihr nicht vorbei.

`Gegner.zeichen` ist ein Index, kein Objekt — `if (g.zeichen < 0)` ist der
vollständige Aufwand für alle ungezeichneten, und das sind die meisten. Ein
Deckel von 70 hält den Posten unabhängig von der Anteilskurve, ein Zähler mit
Test hält fest, dass er nicht ausläuft.

## Verhexungen — Schwierigkeit als Regler

Der Pakt der Strafe aus *Hades*: Man stellt sich die Schwierigkeit selbst ein
und bekommt dafür mehr Wertung. Ohne so einen Regler beantwortet eine
Bestenliste nur „wer hat am längsten durchgehalten"; mit ihm lautet die Frage
„wer hat sich am meisten zugemutet und es trotzdem geschafft".

| Verhexung | Was | Punkte |
|---|---|---|
| **Hast** | Gegner laufen 20 % schneller | +15 % |
| **Enge** | Rissfenster 1,6 s → 0,9 s | +30 % |
| **Kargheit** | ein Waffenplatz weniger | +25 % |
| **Blindheit** | keine Minikarte, keine Schreinzeiger | +10 % |
| **Zoll** | jede Etappe kostet 12 maximale Leben | +25 % |
| **Gezeichnet** | doppelt so viele gezeichnete Gegner | +20 % |

Der Faktor ist **additiv** (`1 + Summe`), damit man ihn vor der Wahl im Kopf
ausrechnen kann; alle sechs ergeben ×2,25. Auf dem Titelbild wechselt **W/S**
zwischen Charakter- und Verhexungsreihe — keine neue Taste.

Ein Test hält fest, dass **keine Verhexung den Lauf leichter macht**. Zwei
Untergrenzen sichern das ab: Das Rissfenster fällt nie unter 0,45 s und der
Gürtel nie unter drei Plätze — drei ist die Zersplitterungs-Schwelle, und ein
Lauf, der die Kernregel gar nicht mehr auslösen kann, ist kein schwerer Lauf,
sondern ein kaputter.

## Chronik und Tagesscherbe

Ein Bestwert sagt, wie hoch jemand gekommen ist, nicht *wie*. Die **Chronik**
hält die besten zehn Läufe fest — Punkte, Charakter, Etappe, Zerrüttung, Zahl
der Verhexungen, ein Zeichen für einen Sieg über den Kern. Sie bleibt reine
Aufzeichnung: **kein Eintrag macht einen späteren Lauf leichter**, und ein Test
hält das fest.

Die **Tagesscherbe** (Taste **T**) läuft auf einem Saatwert aus dem Datum: ein
Versuch pro Tag, für alle derselbe. Weil im ganzen Spiel kein `Math.random()`
steht, ergibt derselbe Wert wirklich dieselben Gegner, Türen und Schreine —
genau dafür sind die beiden getrennten Zufallsströme gebaut. Der Versuch wird
beim *Start* vermerkt, nicht am Ende: Sonst wäre Aufgeben ein Freiversuch.

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

Vier Arten, und **Phase zwei ändert das Muster, nicht die Zahlen**: Der Wächter
feuert seine Speichen im Gegenlauf, sodass die Lücken wandern. Der Kolossus
wechselt das Angriffsbild. Der Zerbrecher hat alle vier.

**Flickwerk** ist der Kitt in groß: Er schließt die Risse von allem in seinem
Umkreis *und* alle fünf Sekunden seine eigenen. Er zwingt den Kampf weg vom
Pulk — im Getümmel steht er in seiner eigenen Werkstatt — und ist die
Generalprobe für den Kern, an dem dieselbe Frage hängt: Schaffst du drei
verschiedene Waffen *innerhalb* eines Fensters?

Die Bosse laufen **reihum** statt ab der vierten Welle immer derselbe zu sein.
Vorher blieb es beim Zerbrecher, und damit bestand die zweite Hälfte jedes
Laufs aus demselben Kampf — bei sechs Etappen bis zum Kern sähe man vier davon
denselben Gegner.

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
| **Kernscherbe** | +45 % Schaden, Risse halten 1 s länger | −30 Leben, **sie zersplittert selbst** | den Kern legen |

Die **Kernscherbe** ist der einzige Ort im Spiel, an dem die Kernregel gegen den
Spieler läuft: Sie ist selbst aus Glas. Trifft ein Gegner sie, setzt er einen
Riss an *ihr* — das Bit kommt aus dem Index seiner Gegnerart. Drei Risse von
drei **verschiedenen** Arten innerhalb von vier Sekunden, und sie zersplittert:
22 % ihrer vollen Leben weg, dafür reißt alles im Umkreis auf und wird
weggeschleudert. Ihre Schwäche ist zugleich ihre stärkste Waffe.

Warum drei *verschiedene* Arten und nicht einfach drei Treffer: In einem Feld
aus lauter Splittern feuert das fast nie. Es feuert genau dann, wenn das Feld
gemischt ist — spät, im Gedränge, neben Bossen und Speiern. Die Gefahr wächst
mit demselben Verlauf wie das Spiel, statt eine feste Steuer auf jeden Treffer
zu sein. Ihre Risse stehen sichtbar auf der Figur, mit Warnring beim zweiten:
Die Kernregel ist nur dann eine Regel, wenn man ihren Stand sieht.

Der **Punkte-Faktor** hält die schwereren konkurrenzfähig:

```
Punkte = (Sekunden × 10 + Kills + Stufe × 50 + Zersplittert × 2 + Bosse × 500)
       × Charakter-Faktor
       + Etappen × 300
       + 4000 bei einem Sieg über den Kern
       × (1 + Zerrüttung × 0,5)
       × (1 + Summe der Verhexungen)
```

Gespeichert wird über `localStorage` genau viererlei: welche Charaktere offen
sind, der beste Punktestand, die Chronik und die zuletzt gewählten
Verhexungen. Keine Werte, keine Rechenkraft, nichts, was einen späteren Lauf
leichter macht. Ein Test hält das fest, weil diese Regel beim Balancing als
Erstes aufweicht.

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
npm run test       # 274 Tests: Waffen, Karten, Risse, Gegner, Zeichen, Bosse, Kern,
                   #            Etappen, Verhexungen, Chronik, Gefühl, Ton, Determinismus
npm run perf       # Simulation ohne Zeichnen, misst ms pro Tick
npm run smoke      # startet das Spiel im Browser, misst die Bildzeit,
                   # legt Screenshots ab
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
  render/   Zeichnen, Federnetz, Glut, Partikel, Erschütterung, Anzeige
  ui/       Menüs und alle Texte
public/
  schrift/  Die einzige Asset-Datei im Projekt: Space Grotesk plus Lizenz
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

### Ein Bit je Platz — und seit der Kernscherbe auch am Spieler

`platz` ist zugleich der Index im Gürtel **und** das Bit für die Risse. Beim
Verschmelzen fallen zwei Einträge weg und einer kommt hinzu — würde der Platz
aus der Array-Länge kommen, bekämen danach zwei Waffen dasselbe Bit, und die
Kernregel wäre im Spiel unsichtbar ausgehebelt. Deshalb: **kleinster freier
Index**, und er bleibt an der Waffe kleben. Fünf reservierte Plätze dahinter
gehören den Scherben, dem Geisterriss, den Dornen des Kolosses, dem
Fehlschlag-Riss und dem Frostkeil.

Seit der Kernscherbe zeigt dieselbe Buchführung auch auf den Spieler: An ihr
steht das Bit für die **Gegnerart**, die getroffen hat. Deshalb nimmt
`rissSetzen` nicht mehr einen `Gegner`, sondern einen schmalen Typ `Rissbar` —
es gibt *eine* Buchführung für Risse im ganzen Spiel, und wer sie führt, ist ihr
egal. Feindgeschosse tragen ihre Quelle bis zum Einschlag mit, sonst wäre „drei
verschiedene Arten" im Fernkampf eine Lüge.

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
| dieselbe Mischung, **gewichtet wie im Spiel** | 2,2 ms | 3,9 ms |
| dieselbe Mischung **mit siebzig gezeichneten Gegnern** | 2,1 ms | 3,1 ms |
| 2000 Gegner | 4,5 ms | 5,8 ms |

Das ganze Waffensystem kostet also praktisch nichts, Bosse ebenso wenig — und
neun Gegnerverhalten statt einem kosten rund zwei Zehntel Millisekunden. Die
Obergrenze steht bei 1400, weil bei 2000 der p95 das Budget reißt.

Dass die Zeile *mit* Zeichen **schneller** ist als die ohne, sieht falsch aus
und ist es nicht: Zwischen beiden Messungen liegt der Zonendeckel (siehe unten).
Siebzig gezeichnete Gegner kosten weniger als die 380 Zonen, die vorher unbemerkt
mitliefen.

Die Messung füllt bewusst mit **allen** Arten gemischt. Vorher lief sie nur mit
Splittern und sah von den neuen Verhalten deshalb nichts: keine kreisenden
Schwärmer, keine Vorwarnungen, keine Speier-Geschosse, keine Umkreisabfragen
des Kitts.

Beim Messen kam eine Sache heraus, die man nicht vermutet: Das
Auseinanderdrücken der Gegner **spart** Rechenzeit. Wird die Trennkraft
gedeckelt, verklumpen sie, und dann liefert jede Gitterabfrage riesige
Kandidatenlisten — mit Deckel kostete derselbe Zustand 11,7 statt 4,5 ms.

### Und was bisher niemand gemessen hat: das Bild

`npm run perf` misst **nur den Tick**. Das ist sein Zweck — er läuft ohne
Browser. Aber die Glut-Schicht, das Federnetz, die Vignette und der Staub sind
*Zeichen*kosten und dort schlicht unsichtbar: Das Bloom hätte still acht
Millisekunden je Bild verschlingen können, und es wäre erst beim Spielen
aufgefallen. Ohne diese Zahl wäre die ganze Bildrunde ein Blindflug gewesen.

Also misst der Browser-Test sie jetzt, in zwei Zuständen:

| Zustand | Median | p95 |
|---|---|---|
| gewöhnlicher Lauf nach einer Minute (~40 Gegner) | 0,9 ms | 1,1 ms |
| 1300 Gegner, alle im Bild, fünf ausgereizte Waffen, 70 gezeichnete | 8,2 ms | 10,0 ms |

Der zweite Wert braucht einen Vorbehalt, und der gehört neben die Zahl statt in
eine Fußnote: **Der Prüflauf hat keine Grafikkarte.** Chromium meldet sich dort
als *SwiftShader*, also als reiner Software-Rasterisierer auf vier Kernen —
jede Füllung, jeder Strich und vor allem jede additive Überlagerung der Glut
wird von der CPU gerechnet. Auf jedem Rechner mit Grafikkarte läuft dieselbe
Leinwand über die GPU und liegt um ein Vielfaches darunter. Die Schranke im
Test (15 ms) ist deshalb **kein Versprechen über Bildwiederholrate**, sondern
eine Regressionsschranke auf der langsamsten Maschine, die das Projekt
regelmäßig sieht.

Aufgeschlüsselt durch Weglassen je einer Schicht, jede in einer frischen Seite
gemessen:

| Schicht | Anteil am Bild |
|---|---|
| Gegner — Füllung, Kontur, Schraffur | ~6,5 ms |
| Anzeige, Kristalle, Partikel, Bruchlinien | ~1,5 ms |
| Federnetz, Korn, Flecken, Zonen, Geschosse | unter dem Messrauschen |

Das **Federnetz ist damit die billigste sichtbare Änderung** — das auffälligste
Stück Bild kostet nichts Messbares. Teuer sind die Gegner, und das stimmt auch:
rund tausend Formen, jede mit zwei Pfaden und einem Strich.

Der Wechsel auf Druck war **nicht** teurer, sondern deutlich billiger: Die
Glut-Schicht kostete rund dreieinhalb Millisekunden je Bild und ist ersatzlos
weg; Korn, Kantenversatz und Schraffur zusammen kosten weniger als sie. Von
11,4 auf 8,2 ms im Median.

Das hatte eine Nebenwirkung, die kein Plan vorhergesehen hat: **Ein Test wurde
rot, weil das Spiel schneller wurde.** `core/loop.ts` verwirft
Simulationszeit, wenn ein Bild zu lange braucht (`MAX_TICKS_PRO_BILD`, danach
`speicher = 0`). Bei 11,4 ms fiel der Lauf im Prüflauf ständig zurück; bei
8,2 ms hält er Schritt und kommt in denselben drei Sekunden weiter — weit
genug, um beim Entpausieren eine Stufe fällig zu haben. Der Test prüfte
`phase === 'laufend'` und traf `'levelup'`. Der Lauf ging also weiter, genau
wie er soll; ein Test, der bei *mehr* Spielfortschritt rot wird, misst die
falsche Sache und prüft jetzt, was er meint: dass die Pause weg ist.

Auf dem Weg dahin lag ein Umbau, der offensichtlich schneller sein *musste* und
es nicht war. `stroke()` über tausend Formen mit runden Ecken gilt als teuer,
also sollte die Kontur eine zweite, größere **Füllung** darunter werden. Gemessen
kostete der zusätzliche Pfadaufbau mehr als der Strich, den er einsparen sollte:
15,3 statt 12,2 ms. Der Strich blieb, mit der Messung im Kommentar, damit es
niemand ein zweites Mal versucht. Was wirklich half, war banaler und stand
in keiner Vermutung: **Gegner außerhalb des Bildes gar nicht erst zeichnen** —
`entferneVerlorene` hält sie bis zum 2,4-fachen Sichtradius am Leben, und ein
guter Teil davon wurde in jeden Pfad aufgenommen, ohne je jemanden zu erreichen.

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

Und in der sechsten Runde, mit dem Kern und den Zeichen:

- **460 Zonen gleichzeitig auf dem Feld.** Der Gegenstand „Splitterfeld"
  stapelt: Mit drei Stück bleibt jede Zersplitterung neun Sekunden lang als Zone
  liegen, und jede einzelne fragt pro Tick ihren Umkreis im Gitter ab. Das war
  der teuerste Posten der ganzen Simulation — ausgelöst von einer Karte, die man
  dreimal zieht, ohne etwas zu ahnen. Im Bild sah man nur, dass viel los ist.
  Selbsttätige Zonenquellen teilen sich jetzt einen Deckel von 80, und die
  Messung fiel von 2,21/3,90 auf 1,51/2,33 ms — **mit** siebzig gezeichneten
  Gegnern obendrauf.
- **Ab der vierten Welle kam immer derselbe Boss.** `bossFuer` klemmte am
  letzten Eintrag fest. Bei drei Bossen und sechs Etappen bis zum Kern hätte man
  vier davon denselben Kampf gesehen. Jetzt laufen sie reihum, und Flickwerk ist
  als vierter dazugekommen.
- **Die Bossleiste stand in der Uhr.** Auf y=78 schnitt ihre Namensplatte die
  Zeitanzeige an und die Etappenzeile lief durch den Balken — im Screenshot mit
  Boss war von „3:20" nur die untere Hälfte zu lesen. Zwei Runden lang hat das
  niemand bemerkt, weil kein Bild einen Boss zeigte *und* auf die Uhr schaute.
- **Ein halber Chronik-Eintrag nahm den ganzen Bildschirm mit.** Der Zeichner
  griff ungeprüft auf `verhexungen.length` zu; ein Eintrag ohne dieses Feld warf
  mitten im Zeichnen, und alles darunter — Charakterreihe, Bestwert,
  Hinweiszeile — fehlte kommentarlos. Ein Zeichner darf an fehlenden Daten nicht
  abbrechen.
- **`textAlign` ist Zustand am Kontext.** Die Chronik zeichnet linksbündig, und
  die Hinweiszeile darunter stand danach nach rechts verschoben. Kein Fehler in
  der Zeile, sondern in der Zeile davor.

Und in der siebten Runde, beim Umbau auf das Nachtfeld:

- **Der Schlagschatten war zweimal umsonst da.** Auf dem hellen Feld gab er
  jedem Körper eine Standfläche; auf dem Nachtfeld ist ein Schatten in
  `rgba(2,3,8,0.55)` schlicht unsichtbar — nichts wirft bei Nacht einen
  Schatten auf Schwarz. Gemessen kostete er einen vollen Pfadaufbau über 1300
  Gegner, also rund drei Millisekunden je Bild, für nichts. Der leuchtende Kern
  hat seinen Platz eingenommen: dieselben Kosten, aber er sagt etwas.
- **Ein Zeichen lag außerhalb der mitgelieferten Schrift.** Die Chronik-Raute
  `◈` steht nicht im Lateinsubset der Schriftdatei — im Browser fiel sie
  kommentarlos auf die Ersatzschrift zurück und stand als einziges Zeichen im
  ganzen Bild in einer anderen Type. Sie ist jetzt ein gezeichneter Pfad. Ein
  Skript prüft, welche Zeichen im Quelltext außerhalb des Subsets liegen; es
  war genau dieses eine.
- **Ein Kamerakick auf einen Treffer am Spieler war Unsinn.** `kickeKamera(s,
  sp.x, sp.y, 0)` stößt die Kamera vom Spieler weg — also von sich selbst, mit
  Stärke null. Bei einem Treffer weiß niemand, woher er kam; dafür ist das
  ungerichtete `s.trauma` da, und das lief längst.
- **Die Bildzeitmessung maß 202 statt 1300 Gegner.** Fünf ausgereizte Waffen
  räumen schneller ab, als der Spawner nachlegt — nach ein paar Sekunden stand
  die Messung auf einem Siebtel des Feldes. Eine Bildzeit auf einem Siebtel
  beweist nichts über das Bild, das man wirklich sieht. Sie füllt jetzt **in
  jedem Bild** nach, so wie `test/perf.ts` es je Tick tut.
- **`×1.00` in einem deutschen Spiel.** `toFixed` liefert immer einen Punkt.
  Kein Fehler, den jemand benennen würde — und genau eines der kleinen Zeichen
  dafür, dass eine Oberfläche nicht für die Sprache gemacht wurde, in der sie
  steht. `weapons.ts` hatte den Komma-Helfer längst; die Menüs kannten ihn
  nicht.

Und beim Umbau auf Druck, in derselben Runde:

- **Vier von fünf Zeichen fielen auf dieselbe Farbe.** Siehe oben — der Test
  hat es gemeldet, bevor irgendjemand ein Bild gesehen hat. Das ist der Fall,
  für den Tests da sind: Eine Palettenentscheidung hat eine *Spielregel*
  gebrochen, und im Screenshot wäre es als „hübsch" durchgegangen.
- **Der Spieler ging in der schwarzen Masse unter.** Das benannte Risiko dieser
  Richtung, und es trat im ersten Bild prompt ein: Tausend Körper in massiver
  Tinte, und eine weiße Scheibe von dreizehn Punkten darin ist nicht
  auffindbar. Statt den Spieler heller zu machen, wird jetzt *seine Umgebung
  Papier* — eine Aussparung im Druckstock.
- **Die vollendete Zeitwaffe schraffierte den ganzen Bogen zu.** 700 Punkte
  Radius, und bei voller Dichte verschwand das Papier. Der Andruck nimmt jetzt
  mit der Größe ab, so wie eine Presse große Flächen dünner aufträgt.
- **Zweimal stand die Farbe falsch herum.** Der Menüschleier und die Säume um
  die Anzeige lagen in Tinte — auf dunklem Feld richtig, auf hellem Papier zwei
  schwarze Bänder quer über das Bild. Beide arbeiten jetzt wieder *gegen* das
  Feld, also in Papier. Dieselbe Zeile hat damit zum dritten Mal die Farbe
  gewechselt, und jedes Mal aus demselben Grund.

## Was noch fehlt

- **Musik.** Klänge gibt es, einen Soundtrack nicht.
- **Bossbalance.** Gemessen über fünf Läufe schwankt ein Bosskampf zwischen 4
  und 100 Sekunden — je nachdem, ob der Bau Einzelziel-Schaden hat. Dass ein
  Flächenbau sich am Boss schwertut, ist gewollt; diese Spanne ist zu groß. Für
  den **Kern** gilt dasselbe in schärfer: Er ist so gebaut, dass ihn nur die
  Kernregel legt — wie lange das mit zwei ausgereizten Waffen wirklich dauert,
  sagt keine Tabelle, sondern erst das Gamepad.
- **Eine echte Bestenliste.** Chronik, Punkte, Verhexungsfaktor und Tagessaat
  stehen — alles lokal. Online daraus zu machen ist jetzt wirklich nur noch ein
  Datenfeld: Der Eintrag in `game/chronik.ts` ist bereits das Format, das ein
  Server bekäme.
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
