# Gear Sniper

Findet Schnäppchen bei Streaming-Hardware – neu wie gebraucht – und meldet sie
von allein per Discord. Vorbild ist der Key Sniper, nur eben für Technik statt
für Spiele-Keys.

Vier Quellen:

| Quelle | Was sie liefert |
|---|---|
| **Jagd** | Gezielte Modelle (**Grafikkarten** und **Streaming-Gear**) — verglichen mit vergleichbaren Anzeigen, mit Betrugsschutz. **Der Hauptzweck**, siehe [JAGD.md](JAGD.md) |
| **Kleinanzeigen** | Elgato-Gebrauchtangebote, automatisch gegen den Neupreis gerechnet |
| **Elgato-Shop DE** | kompletter Katalog (578 Produkte) mit UVP, aktuellem Preis und Lagerstatus |
| **Watchlist** | beliebige Produkt-Links anderer Shops, die du selbst einträgst |

Der Gebrauchtmarkt ist der interessante Teil: 50 % unter Neupreis kommen dort
ständig vor, im offiziellen Shop praktisch nie.

## Wie es aufgebaut ist

```
GitHub Actions  ──sammelt──►  prices.json / deals.json / history.json / markt.json
                                        │              │
Cloudflare Worker  ──liest──────────────┘              │  Oberfläche + Discord
                                                       │
Live-Poller (eigener PC, 60 s)  ──liest markt.json─────┘  ──►  Discord sofort
```

Das Sammeln läuft **nicht** im Worker. Ein Elgato-Produkt-JSON ist rund 500 KB,
und der Cloudflare-Free-Plan gibt einem Cron-Lauf nur 10 ms CPU und 50
Subrequests. Deshalb macht die schwere Arbeit GitHub Actions, und der Worker
holt sich pro Alarm-Lauf genau **eine** kleine Datei.

Der **Live-Poller** kam dazu, weil GitHub Actions real alle 17–190 Minuten
läuft. Zum Sniping ist das zu langsam: ein deutlich unterbewertetes Angebot ist
nach 5–15 Minuten weg. Arbeitsteilung seitdem: GitHub rechnet die Marktpreise
(braucht bundesweite Daten, darf langsam sein), der Poller sucht im Umkreis und
schlägt sofort Alarm.

## Abholort einstellen

Der Ort steht **nicht** in `config.json` — dieses Repo ist öffentlich, und eine
Postleitzahl plus Abholradius grenzt einen Menschen stark ein. Gelesen wird in
dieser Reihenfolge: Umgebungsvariablen → `standort.json` → `config.json`.

**Lokal:** eine Datei `standort.json` daneben (per `.gitignore` geschützt):

```json
{ "ortId": 1234, "plz": "DEINE-PLZ", "ort": "Dein Ort", "radiusKm": 15 }
```

Die `ortId` liefert Kleinanzeigen selbst: `https://www.kleinanzeigen.de/s-ort-empfehlungen.json?query=DEINE-PLZ`
antwortet mit `{"_1234":"DEINE-PLZ Dein Ort"}` — die Zahl hinter dem Unterstrich ist es.

**In GitHub Actions:** Settings → Secrets and variables → Actions, drei Stück:
`SNIPER_ORT_ID`, `SNIPER_PLZ`, `SNIPER_ORT`. Fehlen sie, sucht der Sammler
bundesweit statt abzubrechen — dann stehen im Cloud-Alarm eben auch Funde, zu
denen niemand hinkommt.

`radiusKm` und `hartFiltern` bleiben in `config.json`: das sind Einstellungen,
die niemanden verraten.

## Live-Poller

```bash
node sniper-live.mjs --once --dry-run --warum
```

| Schalter | Wirkung |
|---|---|
| `--once` | ein Durchlauf statt Dauerbetrieb |
| `--dry-run` | kein Discord, nichts gespeichert |
| `--warum` | zeigt die knapp Gescheiterten mit Zahlen — **das Tuning-Werkzeug** |
| `--takt=120` | Sekunden zwischen den Durchläufen (Standard 60) |

Im Dauerbetrieb: `live.cmd` doppelklicken. Beenden mit Strg+C.

Discord-Webhook in eine Datei `webhook.txt` legen (eine Zeile, per `.gitignore`
geschützt) oder als Umgebungsvariable `DISCORD_WEBHOOK` setzen.

Der allererste Start macht eine **stille Einlaufrunde**: er merkt sich alle
vorhandenen Anzeigen, ohne sie zu melden. Ohne das käme sofort eine Flut zu
Angeboten, die seit Wochen stehen.

`--warum` ist wichtiger als es klingt: „0 Funde" sieht identisch aus, wenn
gerade nichts da ist und wenn eine Schwelle zu hart steht.

## Was zählt als Fund

Nicht der Rabatt, sondern was übrig bleibt:

```
Erlös − Einkauf − 11 % Verkaufsgebühr − Versand − (km × 2 × 0,30 €)
```

Der **Erlös** wird gegen das untere Viertel (`p25`) der laufenden Angebote
geschätzt, nicht gegen den Median. Grund: der Median ist, was alle *verlangen* —
wer selbst schnell verkaufen will, steht in derselben Liste und muss unterbieten.

Wie gut die Schätzung wirklich ist, weiß erst das Flip-Buch — nach etwa zehn
echten Verkäufen steht der passende `realFaktor`.

Nachgerechnet: eine Karte 33 % unter Median lässt **5 %** Verzinsung übrig.
Prozente zu melden hieße also, zu Fahrten zu pingen, die sich nicht lohnen.

Schwellen stehen in `config.json` unter `marge` und lassen sich pro Kategorie in
der jeweiligen `jagd*.json` überschreiben.

## Flip-Buch

Ohne das weiß man nach drei Monaten nicht, ob sich das Ganze gelohnt hat — und
der `realFaktor` in der Erlösschätzung bleibt geraten.

```bash
node flip.mjs kauf "RTX 4070" 260 --ort=Moers --km=13 --erwartet=430
```

Dazu `node flip.mjs verkauf <nr> <erlös> --gebuehr=43 --versand=7`,
`node flip.mjs offen` (was liegt, wieviel Kapital gebunden) und
`node flip.mjs bilanz`. Ab drei Verkäufen mit `--erwartet=` vergleicht die
Bilanz Schätzung und Wirklichkeit, ab zehn schlägt sie einen konkreten neuen
`realFaktor` vor. `flips.json` ist per `.gitignore` geschützt.

## Lokal ausprobieren

Node 20 oder neuer, sonst nichts – keine Abhängigkeiten.

```bash
node collector.mjs --mode=fast --dry-run
```

`--dry-run` schreibt nichts, zeigt aber alles an. Weitere Schalter:

| Schalter | Wirkung |
|---|---|
| `--mode=fast` | Watchlist + Kleinanzeigen + rotierender 60er-Block aus dem Katalog (~2 Min) |
| `--mode=full` | kompletter Elgato-Katalog (~10 Min) |
| `--only=elgato\|watch\|ka\|jagd` | nur eine Quelle |
| `--zeige="RTX 4070"` | listet alle zugeordneten Anzeigen eines Jagd-Modells |
| `--dry-run` | nichts schreiben |
| `--simulate-deal=SKU` | künstlichen 60-%-Rabatt setzen, um den Alarm zu testen |

Oder einfach `run.bat` doppelklicken.

## Online stellen

### 1. Repo anlegen

```bash
git init && git add . && git commit -m "Gear Sniper"
git branch -M main
git remote add origin https://github.com/DEINNAME/gear-sniper.git
git push -u origin main
```

Im Repo unter **Settings → Actions → General → Workflow permissions** die
Option *Read and write permissions* setzen – sonst darf der Job die
Preisdateien nicht zurückschreiben.

Danach einmal **Actions → Preise sammeln → Run workflow** mit `full` starten,
damit die erste `prices.json` entsteht.

### 2. Cloudflare Worker

**Empfohlen: `deploy.bat` doppelklicken.** Die schiebt den Code zu GitHub und
deployt den Worker zu Cloudflare – und wechselt vorher ins richtige
Verzeichnis, was der eigentliche Punkt ist (siehe unten). Von Hand geht auch:

```bash
npx wrangler deploy
```

Der setzt Code, KV-Bindung, `DATA_BASE` und den Cron-Takt gemeinsam – alles
steht in `wrangler.toml`. Einmalig davor `npx wrangler login` und
`npx wrangler secret put DISCORD_WEBHOOK`.

Zwei Stolpersteine: der Befehl muss **aus dem Projektordner** laufen (im
Home-Verzeichnis stolpert wrangler über die gesperrte Windows-Verknüpfung
`Anwendungsdaten`), und das Dashboard darf danach nicht mehr zum Deployen
benutzt werden – siehe unten.

<details>
<summary>Alternativ über das Dashboard (nicht empfohlen)</summary>

1. Kostenloser Account: <https://dash.cloudflare.com>
2. **Workers & Pages → Create → Workers** → Name `gear-sniper` → Deploy
3. **Edit code** → gesamten Inhalt von `worker.js` einfügen → **Deploy**
4. **Settings → Variables and Secrets**:

| Typ | Name | Wert |
|---|---|---|
| Variable | `DATA_BASE` | `https://raw.githubusercontent.com/Hakomine/Gear-Sniper/main` |
| Secret | `DISCORD_WEBHOOK` | Webhook-URL deines Discord-Kanals |

5. **Storage & Databases → KV** → Namespace anlegen → im Worker unter
   **Settings → Bindings** als **`GEAR_KV`** binden.
   Ohne KV läuft es auch, meldet dann aber gelegentlich Deals doppelt.
6. **Settings → Trigger Events → Cron Trigger**: `*/15 * * * *`

**Achtung:** Nach jedem Deploy über den Editor muss Schritt 5 wiederholt
werden – Cloudflare wirft die KV-Bindung dabei raus.

</details>

Worker-URL öffnen – fertig. Die Seite funktioniert auch am Handy.

### 3. Discord-Webhook

Server → Kanal bearbeiten → Integrationen → Webhooks → „Neuer Webhook" → URL
kopieren. Dieselbe URL kommt in Cloudflare **und** als GitHub-Secret
`DISCORD_WEBHOOK` (damit auch ein kaputter Sammler auffällt).

## Wann Alarm kommt

Alle Schwellen stehen als Konstanten oben in `worker.js`:

| Konstante | Standard | Bedeutung |
|---|---|---|
| `ALARM_MIN_PCT` | 50 | % Rabatt auf UVP im Shop |
| `ALARM_USED_PCT` | 50 | % unter Neupreis bei Kleinanzeigen |
| `ALARM_JAGD_PCT` | 25 | % unter dem Median vergleichbarer Anzeigen (Jagd) |
| `jagdWarnPct` (config) | 40 | darüber: gemeldet, aber als „genau prüfen" markiert |
| `jagdScamPct` (config) | 55 | darüber gilt es als Betrug: sichtbar, aber **kein** Alarm |
| `ALARM_HISTLOW_PCT` | 25 | reicht, wenn es zugleich ein Allzeittief ist |
| `ALARM_SUS_PCT` | 85 | darüber: als Betrugsverdacht markiert |
| `ALARM_REDROP_PCT` | 10 | erneut melden erst bei weiterem Preissturz |

Ein gemeldeter Fund bleibt 14 Tage gemerkt und kommt erst wieder, wenn der
Preis nochmal um 10 % fällt. Ohne diese Sperre pingt derselbe Deal alle 15 Minuten.

**Der allererste Lauf meldet viel auf einmal** – für den Sniper ist schließlich
alles neu. Beim Testlauf waren es 39 Gebraucht-Funde in einer Nachricht. Danach
kommen nur noch echte Neuigkeiten.

## Wächter

Stille ist zweideutig: „keine Deals" oder „alles kaputt"? Deshalb:

- `/api/health` zeigt den letzten Cron-Lauf, wie alt die Preisdaten sind und
  ob das KV-Binding greift (`kvGebunden`)
- Sind die Daten älter als 4 Stunden, meldet der Worker das per Discord
  (höchstens 1× pro Stunde)
- 1× täglich kommt ein Lebenszeichen
- Bricht der GitHub-Job ab, meldet er sich selbst

## Erkenntnisse (nicht nochmal reinlaufen)

- **Kleinanzeigens Umkreis ist unverbindlich.** Von 310 Treffern einer
  15-km-Suche lagen 110 weiter weg, der äußerste 50 km. Die Entfernung steht im
  Ort mit drin ("47441 Moers (13 km)") und wird selbst nachgefiltert. Achtung:
  bei ungenauen Orten steht dort "(ca. 50 km)" — das "ca." muss der Regex kennen.
- **Fehlt die km-Angabe, ist die Anzeige am nächsten**, nicht am unbekanntesten:
  Kleinanzeigen lässt sie bei Entfernung null weg. Nicht wegfiltern.
- **`sortierung:neueste` in der URL bewirkt nichts.** Spielt keine Rolle, weil im
  engen Umkreis der lokale Markt eines Modells auf Seite 1 passt.
- **Der Median darf nicht aus dem Umkreis kommen.** Aus zwölf lokalen Anzeigen
  wackelt er mit jedem Angebot. Deshalb: Median bundesweit rechnen, Funde lokal
  suchen. Verkauft wird ohnehin bundesweit.
- **Amazon.de geht nicht.** Liefert eine Captcha-Seite statt Preisen, auch vom
  eigenen PC aus. Zuverlässige Amazon-Preise gäbe es nur über die
  [Keepa-API ab 49 €/Monat](https://keepa.com/api-docs/).
- **Geizhals, Idealo, Cyberport, Notebooksbilliger, Galaxus: HTTP 403.**
  Preisvergleicher wehren automatisierte Abrufe grundsätzlich ab.
- **mydealz-RSS und camelcamelcamel sind tot** – Feeds abgeschaltet bzw. 403.
- **Elgatos `/graphql` antwortet von außen mit 404.** Der stabile Weg ist
  `_next/data/<buildId>/de/de/p/<slug>.json`. Die `buildId` ändert sich bei
  jedem Deploy und wird deshalb pro Lauf frisch geholt.
- **Kein Browser-Spoofing nötig.** Elgato und Kleinanzeigen antworten einem
  ehrlichen, selbst-identifizierenden User-Agent genauso wie Chrome. Also
  bleibt es dabei – mit 1 Sekunde Pause zwischen den Abrufen.
- **Kleinanzeigen-Seiten ab 6 sperrt deren robots.txt.** Der Sammler geht
  deshalb höchstens bis Seite 5 pro Suchbegriff.
- **Der allererste Lauf kennt keine Historie.** „Allzeittief" wird erst nach
  `minHistoryDays` (7) Tagen vergeben – sonst wäre jeder Preis sein eigenes
  Tief und der erste Lauf würde Discord fluten.
- **Beim Gebraucht-Vergleich muss der Produktname am Stück im Anzeigentitel
  stehen.** Die lockere Variante („alle Wörter kommen irgendwo vor") rechnete
  „Elgato Stream Deck MK.2 … Studio Controller" gegen den 999-€-„Stream Deck
  Studio" und meldete −91 %. Ebenfalls aussortiert: Mietanzeigen („MIETE Cam
  Link 4K, 15 €") und Zubehör („Stream Deck Mini Halterung"). Bündel taugen
  nicht als Referenz und werden übersprungen.
- **GitHub hält sich nicht an den Zeitplan.** `*/30 * * * *` läuft auf einem
  kostenlosen Konto real alle **17 bis 190 Minuten** (gemessen über einen Tag).
  Die Warnschwelle steht deshalb auf 4 Stunden – mit 90 Minuten meldete der
  Wächter GitHubs Trödelei statt echter Probleme. Der Nachtlauf um 3 Uhr kam
  entsprechend erst um 6 Uhr.
- **wrangler muss aus dem Projektordner laufen.** Im Home-Verzeichnis liegt
  unter deutschem Windows die versteckte Verknüpfung `Anwendungsdaten` (Verweis
  auf `AppData\Roaming`, mit Zugriffssperre). wrangler durchsucht das
  Verzeichnis und bricht mit einem Berechtigungsfehler ab. Dagegen gibt es
  `deploy.bat`.
- **„Edit code" im Cloudflare-Dashboard wirft die KV-Bindung raus.** Zweimal
  reproduziert: nach jedem Einspielen über den Online-Editor stand
  `kvGebunden: false`. Der Editor lädt den Worker mit seinem eigenen, leeren
  Binding-Satz hoch. Entweder nach JEDEM Deploy das Binding neu setzen – oder
  `wrangler deploy` nehmen, dann kommt die Bindung aus `wrangler.toml` mit.
- **`lastRun: null` bei `/api/health` heißt fast immer: KV fehlt.** Ohne das
  Binding landet der Zustand in einem flüchtigen Zwischenspeicher. Deshalb
  meldet `/api/health` jetzt `kvGebunden` mit.
- **Eine reine Grafikkarten-Anzeige nennt nie eine CPU.** Der Median der
  RTX 4060 lag zuerst bei 849 € statt 280, weil Gaming-Notebooks („Lenovo
  Legion", „Dell Inspiron") mitgerechnet wurden – ohne das Wort „Laptop" im
  Titel. Wer „Ryzen 7" oder „i9-13900H" schreibt, verkauft einen Rechner.
  Achtung: „Strix", „TUF", „Nitro" und „Pulse" heißen auch Grafikkarten und
  dürfen nicht auf die Ausschlussliste.
- **Betrugsverdacht wird angezeigt, aber nicht gemeldet.** Wer auf eine 4090
  für 400 € gepingt wird, gewöhnt sich an, Alarme zu ignorieren.
- **Elgatos `buildId` ändert sich mitten im Lauf.** Am 07.08.2026 scheiterte
  der Nachtlauf nach 3 Minuten: Elgato hatte während des Sammelns neu
  veröffentlicht, danach lief jeder Abruf auf 404 und die Notbremse griff.
  Schnellläufe (2 Min) trifft das kaum, ein Volllauf (25 Min) schon. Der
  Sammler holt jetzt nach 5 Fehlern in Folge selbst eine frische `buildId` und
  macht weiter; die davor durchgefallenen Produkte holt ein zweiter Anlauf am
  Ende nach. Testbar mit `--buildid=<alte-id>`.
- **Ein fehlender `DISCORD_WEBHOOK` fällt sonst nirgends auf.** Der Worker
  sendet dann klaglos ins Nichts: Cron grün, `ok: true`, aber nie eine
  Nachricht. Am 08.08.2026 war das Secret beim Gear Sniper verschwunden –
  vermutlich beim Umstieg vom Dashboard auf `wrangler deploy`. Gegenprobe:
  `npx wrangler secret list`, und `/api/health` zeigt jetzt `webhookGesetzt`.
- **Der Tagespunkt im Preisverlauf kommt nur vom Nachtlauf.** Sonst änderte
  sich `history.json` 48-mal täglich und würde das Repo mit Commits zumüllen.

## Dateien

- `collector.mjs` – der Sammler, **die Hauptdatei** für die Datenbeschaffung
- `sniper-live.mjs` – der Live-Poller (60 s, Umkreis, sofortiger Alarm)
- `marge.mjs` – die Margenrechnung, von Sammler und Poller gemeinsam benutzt
- `flip.mjs` – das Flip-Buch
- `worker.js` – Oberfläche, `/api/deals`, `/api/health` und der Discord-Alarm
- `jagd.json` / `jagd-streaming.json` – die Jagd-Kategorien, siehe [JAGD.md](JAGD.md).
  Der Sammler liest **alle** `jagd*.json`; eine neue Kategorie braucht keinen Code
- `config.json` – Standort, Margenschwellen, Suchbegriffe, Tempo
- `watchlist.json` – deine eigenen Produkt-Links
- `prices.json` / `deals.json` / `history.json` – erzeugt der Sammler
- `markt.json` – Preisverteilung je Modell, die Brücke zum Live-Poller
- `.github/workflows/collect.yml` – der Cloud-Job
- `run.bat` – lokaler Sammellauf per Doppelklick
- `live.cmd` – Live-Poller per Doppelklick
- `deploy.bat` – veröffentlichen per Doppelklick (GitHub + Cloudflare)

Nur lokal, nie im Repo (`.gitignore`): `webhook.txt`, `standort.json`,
`gesehen.json`, `latenz.csv`, `flips.json`.
