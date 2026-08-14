---
tags: [projekt, tool]
status: aktiv
erstellt: 2026-08-05
---

# Gear Sniper

Eigene App, die den Markt nach Schnäppchen bei Streaming-Hardware absucht und
bei krassen Angeboten **von allein per Discord Bescheid gibt**. Gleiches Prinzip
wie [[Key Sniper]], nur für Technik statt Spiele-Keys: Elgato-Kram wie Facecam,
Stream Deck, Key Light und Wave.

Auslöser war die Frage nach einem Sniper für Elgato-Cams – plus der Hinweis, dass
ein Kollege eine Elgato Cam Link 4K auf Kleinanzeigen für 50 € geschossen hat.
Genau dieses Muster sucht die App: **Gebraucht-Angebot deutlich unter Neupreis.**

Eigenständiges Tool, läuft unabhängig von allem anderen.

## Wo es läuft
- **Sammler**: GitHub Actions. Alle 30 Min ein Schnelllauf, nachts um 3 der
  komplette Elgato-Katalog. Schreibt `prices.json` zurück ins Repo.
- **Cloud-App**: Cloudflare Worker. Zeigt alles im Browser (auch am Handy) und
  schickt den Discord-Alarm.
- **Lokal**: `run.bat` für einen Sammellauf am eigenen PC, z.B. zum Testen.
- **Live-Poller**: `live.cmd` — Dauerlaufer auf dem eigenen PC, 60-Sekunden-Takt.
  Seit dem Flip-Umbau der eigentliche Alarmweg, siehe unten.

Warum getrennt: ein Elgato-Produkt-JSON ist ~500 KB. Der Cloudflare-Free-Plan
gibt einem Cron-Lauf 10 ms CPU und 50 Subrequests – der komplette Katalog passt
da nie rein. Also sammelt GitHub, und der Worker liest nur die fertige Datei.

## Die vier Quellen

| Quelle | Was sie bringt |
|---|---|
| **Jagd** | Gezielte Modelle, aktuell Grafikkarten — **der Hauptzweck** |
| **Kleinanzeigen** | Elgato-Gebrauchtangebote gegen den Neupreis gerechnet |
| **Elgato-Shop DE** | 578 Produkte mit UVP, aktuellem Preis und Lagerstatus |
| **Watchlist** | eigene Produkt-Links, beliebiger Shop, beliebige Marke |

Der Gebrauchtmarkt ist der wichtige Teil. Im offiziellen Shop gibt es 50 %
praktisch nie, auf Kleinanzeigen laufend. Beim ersten Testlauf stand dort direkt
eine „Elgato Premium Facecam" für 50 €.

## Die Jagd (der eigentliche Zweck)

Gezielt auf bestimmte Modelle lauern — seit 06.08.2026 **Grafikkarten**
(vorher Kameras, umgestellt weil der Kamera-Bedarf erledigt war).
Details in `JAGD.md`, Datenbank in `jagd.json`.

**Der Kniff: verglichen wird gegen den Median vergleichbarer Anzeigen, nicht
gegen den Neupreis.** Eine gebrauchte RTX 3070 für 220 € ist gegen 519 €
Neupreis „−58 %" — aber das ist einfach der normale Gebrauchtpreis. Der Median
bildet außerdem den *echten* Markt ab: eine RTX 5090 mit 2329 € Listenpreis
wird auf Kleinanzeigen real um 3900 € gehandelt. Gegen die UVP gerechnet gäbe
es dort nie einen Fund.

Erster Lauf: 211 GPU-Anzeigen, davon 10 echte Funde — u.a. eine
**RTX 5070 Ti für 450 € bei einem Median von 950 €**.

Im Bestand: RTX 5090 bis 5060 Ti, RTX 4090 bis 4060, RTX 3080/3070/3060,
RX 9070 XT, 7900 XTX, 7800 XT.

### Betrugsschutz (der Grund, warum das hier heikel ist)

Drei Ebenen:
1. **Struktureller Müll fliegt raus**: Wasserkühler, leere Kartons („nur OVP"),
   Attrappen, Suchanzeigen, Defekte, Reservierte.
2. **Zu gut, um wahr zu sein** (ab 55 % unter Median) wird markiert, ist in der
   App standardmäßig ausgeblendet — und löst **keinen Alarm** aus. Wer auf eine
   4090 für 400 € gepingt wird, gewöhnt sich an, Alarme zu ignorieren.
3. Jede Meldung trägt die Kaufregeln mit: Abholung mit Test im laufenden
   Rechner, kein Vorkasse-Versand, keine Zahlung per Freunde-Funktion.

Drei Stufen: 25–40 % normaler Fund, 40–55 % gemeldet aber orange markiert
(„entweder ein echter Fund oder eine Masche"), ab 55 % kein Alarm mehr.

## Flip-Umbau (09.08.2026)

Bis dahin war der Sniper ein **Rabatt-Finder**. Umgebaut zum **Geldverdiener**,
weil vier Sachen fehlten, die den Unterschied ausmachen:

**1. Er suchte bundesweit.** Die meisten Funde lagen in Bayern oder Sachsen und
waren damit nicht erreichbar. Jetzt 15 km um den eigenen Wohnort — der steht
in `standort.json` bzw. als GitHub-Secret, **nicht** im öffentlichen Repo.

**2. Er war zu langsam.** GitHub Actions läuft real alle 17–190 Minuten, eine
unterbewertete Karte ist in 5–15 Minuten weg. Dagegen `sniper-live.mjs`:
60-Sekunden-Takt auf dem eigenen PC, nur der Umkreis, nur Seite 1, Dedup über
`gesehen.json`. GitHub macht weiter die langsame Arbeit (Marktpreise, Historie),
der Poller die Geschwindigkeit.

**3. Er verglich gegen Wunschpreise.** Der Median ist, was Leute *verlangen*.
Wer selbst schnell verkaufen will, muss unterbieten — gerechnet wird deshalb
gegen das **untere Viertel** (`p25`) der laufenden Angebote, nicht die Mitte.

**4. Er meldete Prozente statt Euro.** Jetzt zählt nur:
`Erlös − Einkauf − 11 % Gebühr − Versand − Sprit`. Schwellen pro Kategorie.

Dazu das **Flip-Buch** (`flip.mjs`): jeder Kauf und Verkauf wird eingetragen,
daraus kommen echter Gewinn, gebundenes Kapital und Liegezeit — und vor allem
die Kalibrierung des `realFaktor`, der bis dahin geraten ist.

### Zwei Jagd-Kategorien
`jagd.json` (Grafikkarten) und `jagd-streaming.json` (Elgato-Gear). Der Sammler
liest **alle** `jagd*.json`, jede mit eigenen Ausschlüssen und eigenen
Margenschwellen. Neue Kategorie = neue Datei, kein Code.

| Kategorie | Mindestgewinn | Mindestverzinsung |
|---|---|---|
| Grafikkarten | 40 € | 25 % |
| Streaming-Gear | 20 € | 35 % |

Warum unterschiedlich: 40 € kann ein Stream Deck Mini nie schaffen, dessen
ganzer Marktwert liegt bei 42 €.

## Snipe-Logik
- **Jagd (Grafikkarten)**: Alarm zwischen **25 %** und **55 %** unter dem Median
  vergleichbarer Anzeigen. Darüber gilt es als Betrug und wird nicht gemeldet.
- **Rabatt auf UVP**: Alarm ab **50 %** (`ALARM_MIN_PCT` in `worker.js`).
- **Gebraucht**: Alarm ab **50 %** unter dem Neupreis des gleichen Produkts.
  Zuordnung über den Anzeigentitel – alle Wörter des Produktnamens müssen
  vorkommen, der längste Treffer gewinnt (so schlägt „Stream Deck XL" das
  allgemeinere „Stream Deck").
- **Allzeittief**: der Sniper merkt sich jeden gesehenen Preis. Ist ein Produkt
  billiger als je zuvor, reichen schon 25 % für den Alarm.
- **Betrugsbremse**: über 85 % unter Neupreis wird als „verdächtig günstig"
  markiert statt gefeiert. Das ist auf Kleinanzeigen meistens eine Masche.
- **Kein Spam**: Gemeldetes wird 14 Tage gemerkt (KV-Speicher `GEAR_KV`).
  Erneut gemeldet wird erst, wenn der Preis nochmal ≥10 % fällt.

## Die App
Kacheln mit Bild, Preis, durchgestrichener UVP und Rabatt-Abzeichen. Regler für
Mindest-Rabatt, Filter für „nur reduziert", „nur gebraucht", „nur Allzeittief",
„nur auf Lager", dazu Suche und Sortierung. Aktualisiert sich alle 5 Minuten.

## Einrichtung

| Wo | Name | Wofür |
|---|---|---|
| Cloudflare Variable | `DATA_BASE` | raw-Link zum GitHub-Ordner |
| Cloudflare Secret | `DISCORD_WEBHOOK` | Alarm-Nachrichten |
| Cloudflare Binding | `GEAR_KV` | merkt sich Gemeldetes |
| Cloudflare Trigger | `*/15 * * * *` | Alarm-Takt |
| GitHub Secret | `DISCORD_WEBHOOK` | Meldung wenn der Sammler abbricht |
| GitHub Secret | `SNIPER_ORT_ID` | Abholort — steht bewusst nicht im öffentlichen Repo |
| GitHub Secret | `SNIPER_PLZ` | dito, nur für die Anzeige im Alarm |
| GitHub Secret | `SNIPER_ORT` | dito |
| GitHub Setting | Workflow: Read and write | damit der Job Preise zurückschreiben darf |
| lokal | `standort.json` | derselbe Ort für den Live-Poller, gitignored |
| lokal | `webhook.txt` | Discord-Webhook des Live-Pollers, gitignored |

**Kein API-Key nötig** – keine der vier Quellen verlangt einen.

## Wächter
Stille ist zweideutig: keine Deals oder alles kaputt? Deshalb meldet der Worker,
wenn die Preisdaten älter als 4 Stunden sind, schickt 1× täglich ein
Lebenszeichen und zeigt seinen Zustand unter `/api/health`. Bricht der
GitHub-Job ab, meldet der sich selbst.

## Erkenntnisse (nicht nochmal reinlaufen)
- **Amazon.de geht nicht.** Captcha-Seite statt Preis, auch vom eigenen PC.
  Zuverlässige Amazon-Preise gäbe es nur über die Keepa-API ab 49 €/Monat.
  Für Amazon bleibt der kostenlose Preiswecker bei idealo/Geizhals die Ergänzung.
- **Geizhals, Idealo, Cyberport, Notebooksbilliger, Galaxus geben 403.**
  Preisvergleicher wehren automatisierte Abrufe grundsätzlich ab.
- **mydealz-RSS und camelcamelcamel sind tot** – abgeschaltet bzw. 403.
- **Elgatos `/graphql` antwortet von außen mit 404.** Der stabile Weg ist
  `_next/data/<buildId>/de/de/p/<slug>.json`. Die `buildId` ändert sich bei jedem
  Deploy von Elgato und wird deshalb pro Lauf frisch geholt.
- **Kein Browser-Spoofing nötig.** Elgato und Kleinanzeigen antworten einem
  ehrlichen User-Agent genauso. Bleibt so, mit 1 Sekunde Pause zwischen Abrufen.
- **Kleinanzeigen sperrt Suchergebnis-Seiten ab 6** in der robots.txt – der
  Sammler geht deshalb höchstens bis Seite 5 pro Suchbegriff.
- **50 % im Elgato-Shop sind selten.** Der Shop-Alarm wird eher zu Black Friday
  losgehen als im August. Die App zeigt trotzdem jeden Rabatt an, sonst wäre sie
  elf Monate im Jahr leer. (Beim ersten Lauf lief gerade Summer Sale: bis −40 %.)
- **Beim Gebraucht-Vergleich muss der Produktname am Stück im Anzeigentitel
  stehen.** Die lockere Variante rechnete „Stream Deck MK.2 … Studio Controller"
  gegen den 999-€-„Stream Deck Studio" – sah aus wie −91 %, war Unsinn.
  Ebenso aussortiert: Mietanzeigen und Zubehör (eine Halterung fürs Stream Deck
  ist kein Stream Deck). Bündel taugen nicht als Referenzpreis.
- **Der allererste Alarm ist laut.** Im Test waren es 54 Funde auf einmal, weil
  für den Sniper alles neu ist. Danach kommt nur noch Neues.
- **Bei der Jagd ist der Neupreis als Referenz wertlos.** Jede normale
  Gebrauchtanzeige sähe wie ein Schnäppchen aus. Der Median vergleichbarer
  Anzeigen ist die richtige Messlatte — und pflegt sich von selbst.
- **Zubehör erkennt man an der Wortstellung, nicht am Wort.** Steht das Modell
  vorne im Titel, ist es die Kamera; steht es hinten in einer
  Kompatibilitätsliste, ist es Zubehör. „X für Y" heißt Zubehör, „Y für Zweck"
  nicht. Reine Wortlisten reichen nicht: „A6400 mit 16-50 Objektiv" ist ein
  echtes Angebot, „Griff für A6400" nicht.
- **Eine Kia-Stahlfelge matchte auf die Sony Alpha 6000** — Teilenummer
  `52910-A6000`. Seitdem muss auch die Marke im Titel stehen.
- **Eine reine Grafikkarten-Anzeige nennt nie eine CPU.** Der Median der
  RTX 4060 lag zuerst bei 849 € statt 280, weil Gaming-Notebooks („Lenovo
  Legion", „Dell Inspiron", „Asus Vivobook") mitgerechnet wurden — keins davon
  hat „Laptop" im Titel. Wer „Ryzen 7" oder „i9-13900H" schreibt, verkauft
  einen Rechner. Aber Vorsicht: „Strix", „TUF", „Nitro" und „Pulse" heißen auch
  Grafikkarten und dürfen nicht auf die Ausschlussliste.
- **„Edit code" im Cloudflare-Dashboard wirft die KV-Bindung raus.** Zweimal
  reproduziert: nach jedem Einspielen über den Online-Editor stand
  `kvGebunden: false`. Der Editor lädt den Worker mit seinem eigenen, leeren
  Binding-Satz hoch. Entweder nach JEDEM Deploy das Binding neu setzen – oder
  `wrangler deploy` nehmen, dann kommt die Bindung aus `wrangler.toml` mit.
- **GitHub hält sich nicht an den Zeitplan.** `*/30` läuft real alle 17 bis 190
  Minuten. Die Warnschwelle steht deshalb auf 4 Stunden, sonst meldet der
  Wächter GitHubs Trödelei statt echter Probleme.
- **Umbenennen im Worker ist gefährlich.** Beim Wechsel von `cam` auf `jagd`
  blieb eine Variable stehen; der Alarm brach mit „cam is not defined" ab. Der
  Testaufbau in `scratchpad/test-worker.mjs` hat es gefangen, bevor es live ging.
- **Umlaute im Normalisierer müssen zu ae/oe/ue werden.** Mit ä→a wurde aus
  „für" ein „fur", und sämtliche Filter liefen ins Leere, ohne zu meckern.
- **Kein Regex mit Schrägstrich in die Worker-Oberfläche.** Die steckt in einem
  Template-String — aus `/^f\//` wird beim Einbetten `/^f//` und die ganze
  Seite bleibt tot. `startsWith` nehmen.

- **Ein fehlender `DISCORD_WEBHOOK` fällt sonst nirgends auf.** Der Worker
  sendet dann klaglos ins Nichts: Cron grün, `ok: true`, aber nie eine
  Nachricht. Am 08.08.2026 war das Secret beim Gear Sniper verschwunden –
  vermutlich beim Umstieg vom Dashboard auf `wrangler deploy`. Gegenprobe:
  `npx wrangler secret list`, und `/api/health` zeigt jetzt `webhookGesetzt`.
- **Ein 429 von Kleinanzeigen hat den ganzen Sammler umgeworfen (14.08.2026).**
  Der Rate-Limit-Zweig in `get` wartete 15/30/45 s, setzte aber nie `lastErr` –
  danach flog ein nacktes `null`, und der catch, der den Ausfall wegstecken
  sollte, kippte beim Lesen von `e.message` selbst um. Vier Fehlschläge in
  Folge, während lokal alles lief: Kleinanzeigen drosselt Rechenzentrums-IPs
  wie die von GitHub Actions, den eigenen Anschluss nicht. Seitdem übersprungene
  Seite statt Abbruch. **Merksatz: ein Fehlerpfad, der selbst fehlschlägt, ist
  schlimmer als keiner.**

### Erkenntnisse aus dem Flip-Umbau (09.08.2026)
- **Kleinanzeigens Umkreis ist nur ein Vorschlag.** Nachgemessen über alle 18
  GPU-Modelle: von 310 Treffern einer 15-km-Suche lagen **110 weiter weg**, der
  äußerste 50 km (Dülmen). Die Suche weitet still auf, wenn sonst zu wenig
  übrig bliebe. Deshalb wird die Entfernung selbst nachgefiltert.
- **Anzeigen ohne km-Angabe sind die nächsten, nicht die unbekannten.** Alle
  nachgeprüften standen im Suchort selbst — Kleinanzeigen lässt die Angabe bei
  Entfernung null weg. Die dürfen also nicht rausgefiltert werden.
- **„(ca. 50 km)" statt „(50 km)".** Bei ungenau hinterlegten Orten schreibt
  Kleinanzeigen ein „ca." davor. Ohne das im Regex blieb die Entfernung leer
  und eine 50-km-Anzeige stand in der 15-km-Liste.
- **`sortierung:neueste` in der URL wird ignoriert.** Egal, weil im engen
  Umkreis der ganze lokale Markt eines Modells auf Seite 1 passt und die
  Dedup-Liste die Reihenfolge unwichtig macht.
- **Prozente lügen, und zwar heftig.** Eine Karte 33 % unter Median lässt nach
  Gebühr, Versand und Sprit **5 % Verzinsung** übrig. Für 25 % netto braucht es
  etwa −45 % — und ab −55 % greift der Betrugsfilter. Das Fenster für
  GPU-Flips ist also schmal, und genau deshalb braucht es den 60-Sekunden-Takt.
- **Der Neupreis-Vergleich beim Elgato-Gebrauchtmarkt war irreführend.** Ein
  „Elgato Stream Deck für 80 €" sah gegen 149,99 € UVP nach −47 % aus. Gegen
  den *Gebraucht*markt (Median 80 €) sind es **0 %**. Genau dieselbe Falle wie
  bei den Grafikkarten, nur eine Kategorie später bemerkt.
- **Ausschlusslisten gehören zur Kategorie, nicht ins Programm.** „key" auf die
  Ausschlussliste zu setzen (gemeint waren Steam-Keys) hätte jedes **Key Light**
  aussortiert. Deshalb pro Kategorie eine eigene Datei — die GPU-Filter für
  CPUs und Notebooks haben bei Elgato ohnehin nichts verloren.
- **„MK.2" und „MK2" sind für den Normalisierer zwei verschiedene Dinge.**
  Aus `MK.2` wird `mk 2`, aus `MK2` bleibt `mk2`. Beide Schreibweisen müssen in
  `queries`, sonst fällt die Hälfte der Anzeigen durch.
- **Aktueller Stand: 0 Funde.** Bei 243 geprüften Anzeigen im Umkreis schafft
  gerade keine beide Schwellen. Das ist kein Fehler, das ist der Markt — der
  beste Kandidat lag bei 17,51 € netto. `node sniper-live.mjs --once --warum`
  zeigt die Knappgescheiterten mit Zahlen.

## Notizen
- Region steht auf DE/EUR.
- Suchbegriffe für Kleinanzeigen stehen in `config.json` unter `kleinanzeigen.queries`
  – da lassen sich jederzeit weitere Marken ergänzen.
- Das Repo ist öffentlich – hier also nichts Privates reinschreiben.
