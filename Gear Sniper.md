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

Alarm gibt es nur im Fenster zwischen 25 % und 55 % unter Median.

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
| GitHub Setting | Workflow: Read and write | damit der Job Preise zurückschreiben darf |

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

## Notizen
- Region steht auf DE/EUR.
- Suchbegriffe für Kleinanzeigen stehen in `config.json` unter `kleinanzeigen.queries`
  – da lassen sich jederzeit weitere Marken ergänzen.
- Das Repo ist öffentlich – hier also nichts Privates reinschreiben.
