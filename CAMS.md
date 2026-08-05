# Cam-Jagd

Der Hauptzweck der App: Kameras finden, die **besser sind als die OBSBOT Meet 2**
(1/2″ Sensor, f/1.8). Welche das sind, steht in `cams.json`.

## Warum der Vergleichspreis nicht der Neupreis ist

Gegen den Neupreis zu rechnen wäre wertlos. Eine gebrauchte Sony A6000 für 250 €
wäre dann „−55 %" — obwohl das einfach der normale Gebrauchtpreis ist. Der Alarm
würde bei jeder zweiten Anzeige losgehen.

Deshalb ist die Referenz der **Median aller Anzeigen für dasselbe Modell**. Ein
Fund ist erst dann einer, wenn er deutlich unter dem liegt, was alle anderen
gerade verlangen. Beispiel aus dem ersten Lauf:

```
Sony Alpha 6400   63 Anzeigen   Median 800 €
  → eine Anzeige mit 300 €  =  −63%  =  echter Fund
```

Der Median rechnet sich selbst aus und braucht keine Pflege. Erst wenn weniger
als `camMinListings` (5) Anzeigen da sind, greift der geschätzte `markt`-Wert
aus `cams.json` als Notnagel. Auf der Karte steht immer dabei, woher der
Vergleich kommt — „Median aus 58 Anzeigen" oder „geschätzter Marktpreis".

Alarmschwelle: **30 %** unter dem Vergleichspreis (`ALARM_CAM_PCT` in `worker.js`).

## Ein Modell ergänzen

In `cams.json` unter `modelle` eintragen:

```json
{
  "name": "Sony ZV-E10",
  "typ": "systemkamera",
  "sensor": "APS-C",
  "blende": "je nach Objektiv",
  "warum": "Kurze Begründung, die im Discord-Alarm mitgeschickt wird.",
  "neu": 699.0,
  "markt": 380,
  "queries": ["zv-e10", "sony zv e10"],
  "marke": ["sony", "zv"]
}
```

| Feld | Bedeutung |
|---|---|
| `queries` | Suchbegriffe bei Kleinanzeigen. Der Modellname muss so im Anzeigentitel stehen |
| `marke` | mindestens eins dieser Wörter muss im Titel vorkommen |
| `markt` | geschätzter Gebrauchtpreis, nur als Notnagel |
| `neu` | Neupreis, wird im Alarm zur Einordnung mitgezeigt |
| `warum` | Warum das ein Upgrade zur Meet 2 ist — steht so in der Discord-Nachricht |

Testen ohne alles andere:

```bash
node collector.mjs --only=cam --dry-run
```

## Wie der Müll rausgefiltert wird

Der erste Testlauf fischte fast nur Zubehör. Vier Filter greifen jetzt:

1. **Marke muss im Titel stehen.** Ohne das matchte eine **Kia-Stahlfelge** auf
   die Sony Alpha 6000 — die Teilenummer lautete `52910-A6000`.
2. **Modellname muss weit vorne stehen** (in den ersten 6 Wörtern). Bei echten
   Anzeigen steht die Kamera am Anfang, bei Zubehör hinten in einer
   Kompatibilitätsliste („Baxxtar Akku … kompatibel Sony A6000 A6300 A6400").
3. **„X für Y" ist Zubehör.** Steht ein „für" *vor* dem Modellnamen, ist es
   Zubehör für die Kamera, nicht die Kamera. Das fängt auch Exoten wie
   „Fusionrig Cineback für Sony a6400" ohne eigene Wortliste.
4. **Wortlisten**, hart und weich getrennt: „Akku", „Buch", „Cage", „kompatibel"
   schließen immer aus. „Objektiv", „Tasche", „Stativ" nur, wenn sie vorne
   stehen — sonst fiele „A6400 mit 16-50 Objektiv" raus, und das ist ein
   ganz normales Kamera-Angebot.

Dazu wird alles aussortiert, was `defekt`, `Bastler` oder `Ersatzteil` im Titel
hat, sowie Mietanzeigen.

## Was drin steht und warum

| Modell | Sensor | Blende | Gegen die Meet 2 |
|---|---|---|---|
| Razer Kiyo Pro Ultra | 1/1.2″ | f/1.7 | ~2,8× Sensorfläche, offenere Blende — der klarste Webcam-Sprung |
| Elgato Facecam Pro | 1/1.8″ | f/2.0 | ~1,6× Fläche, dazu echtes 4K60 |
| OBSBOT Tiny 2 | 1/1.5″ | f/1.9 | Größerer Sensor, gleiche Software |
| Elgato Facecam 4K | 1/1.8″ | **f/4.0** | ⚠️ Nur mit gutem Licht. f/4.0 sind ~5× weniger Licht als f/1.8 — im Dunkeln eher schlechter |
| Sony ZV-E10 / A6400 / A6000 | APS-C | Objektiv | ~30× Sensorfläche. Braucht Cam Link 4K + Dummy-Akku |
| Canon EOS M50 | APS-C | Objektiv | wie oben, sehr verbreitet |
| Panasonic Lumix G7 | MFT | Objektiv | ~15×, bekannt für sauberes HDMI ohne Zeitlimit |

**Nicht aufgenommen**, weil kein Upgrade: Insta360 Link 2 (auch 1/2″) und
Logitech MX Brio (1/2.8″, also kleiner).
