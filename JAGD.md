# Die Jagd

Der Hauptzweck der App: gezielt auf bestimmte Modelle lauern und melden, wenn
eins deutlich unter Marktwert angeboten wird. Aktuell **Grafikkarten**.
Die Modelle stehen in `jagd.json`.

## Warum der Vergleichspreis nicht der Neupreis ist

Gegen den Neupreis zu rechnen wäre wertlos. Eine gebrauchte RTX 3070 für 220 €
wäre gegen 519 € Neupreis „−58 %" — obwohl das einfach der normale
Gebrauchtpreis ist. Der Alarm würde bei jeder zweiten Anzeige losgehen.

Deshalb ist die Referenz der **Median aller Anzeigen für dasselbe Modell**:

```
RTX 5060 Ti   12 Anzeigen   Median 525 €
  → eine Anzeige mit 260 €  =  −50 %  =  echter Fund
```

Der Median rechnet sich selbst aus und braucht keine Pflege. Erst bei weniger
als `jagdMinListings` (5) Anzeigen greift der geschätzte `markt`-Wert aus
`jagd.json` als Notnagel. Auf der Karte steht immer dabei, woher der Vergleich
kommt — „Median aus 12 Anzeigen" oder „geschätzter Marktpreis".

Nebeneffekt: der Median bildet den **echten** Markt ab, nicht die UVP. Eine
RTX 5090 mit 2329 € Listenpreis wird auf Kleinanzeigen real um 3900 € gehandelt.
Gegen die UVP gerechnet gäbe es dort nie einen Fund.

## Betrugsschutz

Bei Grafikkarten wird massenhaft betrogen. Drei Ebenen dagegen:

**1. Struktureller Müll fliegt ganz raus.** Wasserkühler, Lüfter, Shrouds,
leere Kartons („nur OVP"), Poster, Attrappen, Suchanzeigen, Defekte und
Reservierte. Das war der Großteil der ersten Trefferliste.

**2. Zu gut, um wahr zu sein → markiert, aber nicht gemeldet.** Alles ab
`jagdScamPct` (55 % unter Median) gilt als Betrugsverdacht. Es steht weiter in
der App, ist rot markiert und standardmäßig ausgeblendet — aber es kommt
**kein Discord-Ping**. Eine 4090 für 400 € ist kein Schnäppchen, und wer darauf
gepingt wird, gewöhnt sich an, Alarme zu ignorieren.

**3. Jede Meldung trägt die Kaufregeln mit sich:** Abholung mit Test im
laufenden Rechner, kein Vorkasse-Versand, keine Zahlung per Freunde-Funktion.

Konkret drei Stufen, alle in `config.json`:

| Abstand zum Median | Was passiert |
|---|---|
| 25–40 % (`jagdMinPct`) | normaler Fund, wird gemeldet |
| 40–55 % (`jagdWarnPct`) | wird gemeldet, aber orange markiert: „ungewöhnlich günstig – entweder ein echter Fund oder eine Masche" |
| ab 55 % (`jagdScamPct`) | Betrugsverdacht, sichtbar in der App, **kein** Alarm |

## Ein Modell ergänzen

In `jagd.json` unter `modelle`:

```json
{
  "name": "RTX 4070",
  "typ": "gpu",
  "specs": "12 GB GDDR6X",
  "warum": "Kurze Begründung, die im Discord-Alarm mitgeschickt wird.",
  "neu": 589.0,
  "markt": 420,
  "queries": ["rtx 4070"],
  "marke": ["rtx"],
  "nicht": ["ti", "super"]
}
```

| Feld | Bedeutung |
|---|---|
| `queries` | Suchbegriffe bei Kleinanzeigen, müssen so im Titel stehen |
| `marke` | mindestens eins dieser Wörter muss im Titel vorkommen |
| `nicht` | darf **direkt hinter** dem Modellnamen nicht stehen. `["ti","super"]` verhindert, dass eine 4070 Ti als 4070 durchgeht |
| `markt` | geschätzter Gebrauchtpreis, nur Notnagel |
| `neu` | Neupreis, wird im Alarm zur Einordnung mitgezeigt |

Testen und nachjustieren:

```bash
node collector.mjs --only=jagd --dry-run
```

```bash
node collector.mjs --only=jagd --dry-run --zeige="RTX 4070"
```

Das zweite listet **alle** zugeordneten Anzeigen eines Modells mit Preis. Ein
schiefer Median hat immer einen Grund, und so sieht man ihn sofort.

## Wie die Fehltreffer aussortiert werden

1. **Modellname muss weit vorne im Titel stehen** (erste 6 Wörter). Bei echten
   Anzeigen steht das Produkt am Anfang, bei Zubehör hinten in einer
   Kompatibilitätsliste.
2. **„X für Y" ist Zubehör.** Steht ein „für" *vor* dem Modellnamen, ist es
   Zubehör für das Produkt, nicht das Produkt.
3. **Keine CPU im Titel.** Das ist der wichtigste Filter überhaupt — siehe unten.
4. **Kategorie-Ausschlüsse** aus `jagd.json`: Kühler, Kartons, Attrappen.

### Der CPU-Trick

Der Median der RTX 4060 lag zuerst bei **849 €** statt 280. Ursache: lauter
Gaming-**Notebooks** in der Liste — „Lenovo Legion Pro 5", „Dell Inspiron 16",
„Asus Vivobook". Keines davon hat „Laptop" oder „Notebook" im Titel, eine
Wortliste greift also nicht.

Das zuverlässige Merkmal ist ein anderes: **eine reine Grafikkarten-Anzeige
nennt nie eine CPU.** Wer „Ryzen 7", „i9-13900H" oder „Core Ultra 7" schreibt,
verkauft einen ganzen Rechner. Dasselbe gilt für „SSD", „RAM" und
Bildwiederholraten wie „240 Hz". Danach stimmte der Median.

**Vorsicht bei Modellreihen:** „Strix", „TUF", „Nitro" und „Pulse" heißen auch
*Grafikkarten*. Die dürfen nicht auf die Notebook-Ausschlussliste, sonst
verschwinden echte Karten.

## Mehrere Kategorien gleichzeitig

Der Sammler liest **alle** Dateien, die auf `jagd*.json` passen. Aktuell:

| Datei | Kategorie | Mindestgewinn | Mindestverzinsung |
|---|---|---|---|
| `jagd.json` | Grafikkarten | 40 € | 25 % |
| `jagd-streaming.json` | Streaming-Gear (Elgato) | 20 € | 35 % |

Eine neue Kategorie ist also eine neue Datei, kein Codeeingriff.

**Warum getrennte Dateien statt einer großen:** die Ausschlusslisten gehören zur
Kategorie. Die CPU- und Notebook-Filter der Grafikkarten haben bei einem Stream
Deck nichts zu suchen — und umgekehrt hätte `key` auf der gemeinsamen Liste
(gemeint waren Steam-Keys) jedes **Key Light** aussortiert.

Ebenso die Margenschwellen: 40 € Mindestgewinn sind bei einer Grafikkarte
richtig und bei einem Stream Deck Mini unmöglich, dessen kompletter Marktwert
liegt bei 42 €. Jede Datei kann deshalb einen eigenen `marge`-Block tragen, der
die Werte aus `config.json` überschreibt.

### Fallstricke beim Anlegen

- **Ausschlusswörter gegen die eigenen Modellnamen prüfen.** Der Ausschluss
  greift auf ganze Wörter — steht eins davon im Modellnamen, verschwindet das
  Modell lautlos.
- **Schreibvarianten gehören in `queries`.** Aus `MK.2` wird beim Normalisieren
  `mk 2`, aus `MK2` bleibt `mk2`. Wer nur eine Variante einträgt, verliert die
  Hälfte der Anzeigen.
- **Der Vergleichspreis ist immer der Gebrauchtmarkt, nie die UVP.** Ein Elgato
  Stream Deck für 80 € sieht gegen 149,99 € UVP nach −47 % aus. Gegen den
  Gebrauchtmedian von 80 € sind es 0 %.

## Umbauen auf etwas anderes

Die Maschinerie ist nicht auf Grafikkarten festgelegt — sie kannte vorher
Kameras. Zum Wechseln reicht die jeweilige Datei: `label`, `emoji`, `ausschluss`,
`ausschlussMuster` und `modelle` austauschen. Der Code bleibt unangetastet.
