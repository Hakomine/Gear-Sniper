# Watchlist – eigene Produkt-Links

In `watchlist.json` kommt alles rein, was der Elgato-Katalog nicht abdeckt:
andere Marken, andere Shops, ein bestimmtes Modell zum Beobachten.

```json
[
  {
    "name": "Elgato Stream Deck MK.2",
    "shop": "Thomann",
    "url": "https://www.thomann.de/de/elgato_stream_deck_mk2.htm",
    "uvp": 149.99
  }
]
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `url` | ja | Link zur Produktseite |
| `name` | nein | Anzeigename, sonst wird die URL gezeigt |
| `shop` | nein | Anzeigename des Shops, sonst die Domain |
| `uvp` | nein | Referenzpreis für die Rabatt-Rechnung |
| `regex` | nein | eigener Ausdruck, falls der Shop exotisch ist. Gruppe 1 muss der Preis sein |

**Ohne `uvp`** nimmt der Sniper den höchsten je gesehenen Preis als Referenz.
Das heißt: am Anfang steht da 0 %, und der Wert wird über die Wochen brauchbar.
Wenn du den Listenpreis kennst, trag ihn lieber ein.

## Welche Shops funktionieren

Der Sammler zieht den Preis aus der Produktseite, in dieser Reihenfolge:
JSON-LD → `product:price:amount` → `itemprop="price"` → dein eigener `regex`.

Getestet:

| Shop | Ergebnis |
|---|---|
| Thomann | ✅ Preis über Microdata |
| Elgato | ✅ Preis über JSON-LD |
| MediaMarkt | ❌ Seite lädt, Preis kommt erst per JavaScript nach |
| Alternate | ❌ liefert nur die Startseite |
| Amazon | ❌ Captcha |
| Geizhals, Idealo, Cyberport, Notebooksbilliger, Galaxus | ❌ HTTP 403 |

Ein Shop, der nicht geht, verschwindet nicht still: der Eintrag steht in der App
mit `Shop nicht abrufbar` bzw. `no-price` drin. So siehst du den Unterschied
zwischen „kein Rabatt" und „hat nie funktioniert".

## Ausprobieren, bevor du es dauerhaft einträgst

```bash
node collector.mjs --only=watch --dry-run
```

Zeigt pro Eintrag, ob und wie der Preis gefunden wurde.
