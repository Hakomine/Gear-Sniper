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

Getrennt vom [[Kontrollzentrum]] – ist ein eigenes Tool.

## Wo es läuft
- **Sammler**: GitHub Actions. Alle 30 Min ein Schnelllauf, nachts um 3 der
  komplette Elgato-Katalog. Schreibt `prices.json` zurück ins Repo.
- **Cloud-App**: Cloudflare Worker. Zeigt alles im Browser (auch am Handy) und
  schickt den Discord-Alarm.
- **Lokal**: `run.bat` für einen Sammellauf am eigenen PC, z.B. zum Testen.

Warum getrennt: ein Elgato-Produkt-JSON ist ~500 KB. Der Cloudflare-Free-Plan
gibt einem Cron-Lauf 10 ms CPU und 50 Subrequests – der komplette Katalog passt
da nie rein. Also sammelt GitHub, und der Worker liest nur die fertige Datei.

## Die drei Quellen

| Quelle | Was sie bringt |
|---|---|
| **Elgato-Shop DE** | 578 Produkte mit UVP, aktuellem Preis und Lagerstatus |
| **Watchlist** | eigene Produkt-Links, beliebiger Shop, beliebige Marke |
| **Kleinanzeigen** | Gebraucht-Angebote, automatisch gegen den Neupreis gerechnet |

Die Gebraucht-Quelle ist die wichtigste. Im offiziellen Shop gibt es 50 %
praktisch nie, auf Kleinanzeigen laufend. Beim ersten Testlauf stand dort direkt
eine „Elgato Premium Facecam" für 50 €.

## Snipe-Logik
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
| GitHub Setting | Workflow: Read and write | damit der Job Preise zurückschreiben darf |

**Kein API-Key nötig** – keine der drei Quellen verlangt einen.

## Wächter
Stille ist zweideutig: keine Deals oder alles kaputt? Deshalb meldet der Worker,
wenn die Preisdaten älter als 90 Minuten sind, schickt 1× täglich ein
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
- **Der allererste Alarm ist laut.** Im Test waren es 39 Gebraucht-Funde auf
  einmal, weil für den Sniper alles neu ist. Danach kommt nur noch Neues.

## Notizen
- Region steht auf DE/EUR.
- Suchbegriffe für Kleinanzeigen stehen in `config.json` unter `kleinanzeigen.queries`
  – da lassen sich jederzeit weitere Marken ergänzen.
- Das Repo ist öffentlich – hier also nichts Privates reinschreiben.
