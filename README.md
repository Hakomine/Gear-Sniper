# Gear Sniper

Findet Schnäppchen bei Streaming-Hardware – neu wie gebraucht – und meldet sie
von allein per Discord. Vorbild ist der Key Sniper, nur eben für Technik statt
für Spiele-Keys.

Vier Quellen:

| Quelle | Was sie liefert |
|---|---|
| **Cam-Jagd** | Kameras, die besser sind als die OBSBOT Meet 2 — verglichen mit dem Median vergleichbarer Anzeigen. **Der Hauptzweck**, siehe [CAMS.md](CAMS.md) |
| **Kleinanzeigen** | Elgato-Gebrauchtangebote, automatisch gegen den Neupreis gerechnet |
| **Elgato-Shop DE** | kompletter Katalog (578 Produkte) mit UVP, aktuellem Preis und Lagerstatus |
| **Watchlist** | beliebige Produkt-Links anderer Shops, die du selbst einträgst |

Der Gebrauchtmarkt ist der interessante Teil: 50 % unter Neupreis kommen dort
ständig vor, im offiziellen Shop praktisch nie.

## Wie es aufgebaut ist

```
GitHub Actions  ──sammelt──►  prices.json / deals.json / history.json
                                        │
Cloudflare Worker  ──liest──────────────┘  ──►  Oberfläche + Discord-Alarm
```

Das Sammeln läuft **nicht** im Worker. Ein Elgato-Produkt-JSON ist rund 500 KB,
und der Cloudflare-Free-Plan gibt einem Cron-Lauf nur 10 ms CPU und 50
Subrequests. Deshalb macht die schwere Arbeit GitHub Actions, und der Worker
holt sich pro Alarm-Lauf genau **eine** kleine Datei.

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
| `--only=elgato\|watch\|ka\|cam` | nur eine Quelle |
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

Worker-URL öffnen – fertig. Die Seite funktioniert auch am Handy.

Alternativ per CLI: `npm i -g wrangler`, dann `wrangler deploy` und
`wrangler secret put DISCORD_WEBHOOK`.

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
| `ALARM_CAM_PCT` | 30 | % unter dem Median vergleichbarer Kamera-Anzeigen |
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
- **`lastRun: null` bei `/api/health` heißt fast immer: KV fehlt.** Ohne das
  Binding landet der Zustand in einem flüchtigen Zwischenspeicher. Deshalb
  meldet `/api/health` jetzt `kvGebunden` mit.
- **Der Tagespunkt im Preisverlauf kommt nur vom Nachtlauf.** Sonst änderte
  sich `history.json` 48-mal täglich und würde das Repo mit Commits zumüllen.

## Dateien

- `collector.mjs` – der Sammler, **die Hauptdatei** für die Datenbeschaffung
- `worker.js` – Oberfläche, `/api/deals`, `/api/health` und der Discord-Alarm
- `cams.json` – die Kamera-Datenbank der Cam-Jagd, siehe [CAMS.md](CAMS.md)
- `config.json` – Schwellen, Suchbegriffe, Tempo
- `watchlist.json` – deine eigenen Produkt-Links
- `prices.json` / `deals.json` / `history.json` – erzeugt der Sammler
- `.github/workflows/collect.yml` – der Cloud-Job
- `run.bat` – lokaler Start per Doppelklick
