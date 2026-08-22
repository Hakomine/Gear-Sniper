import { describe, expect, it } from 'vitest'
import type { Spielstand } from '../src/game/state'
import { erzeugeSpielstand, starteLauf } from '../src/game/state'
import { zieheAngebote } from '../src/game/upgrades'
import { MAX_WAFFEN, ruesteAus, WAFFEN, werteAuf } from '../src/game/weapons'

/**
 * Die Levelup-Karten.
 *
 * Der Grund fuer den ganzen Umbau: Vorher standen dort nur Zahlenschieber.
 * Diese Tests halten fest, dass Waffen die Karten beherrschen - und dass nie
 * ein reiner Statistik-Bildschirm erscheint.
 */

function stand(saat = 777): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  return s
}

function istWaffenKarte(art: string): boolean {
  return art === 'waffe' || art === 'stufe'
}

describe('Kartenziehung', () => {
  it('liefert nie dieselbe Karte zweimal', () => {
    const s = stand()
    for (let i = 0; i < 400; i++) {
      const karten = zieheAngebote(s, 3)
      expect(new Set(karten.map((k) => k.id)).size).toBe(karten.length)
    }
  })

  it('bietet immer mindestens eine Waffenkarte an', () => {
    // Die Garantie, um die es geht. Ein Bildschirm aus drei passiven Werten
    // ist genau das Gefuehl, das weg sollte.
    const s = stand()
    for (let i = 0; i < 400; i++) {
      const karten = zieheAngebote(s, 3)
      expect(karten.some((k) => istWaffenKarte(k.art))).toBe(true)
    }
  })

  it('fuellt bis zur gewuenschten Anzahl auf', () => {
    const s = stand()
    expect(zieheAngebote(s, 3)).toHaveLength(3)
  })

  it('zieht bei gleichem Saatwert dieselben Karten', () => {
    const a = zieheAngebote(stand(4242), 3).map((k) => k.id)
    const b = zieheAngebote(stand(4242), 3).map((k) => k.id)
    expect(a).toEqual(b)
  })
})

describe('Waffenplaetze', () => {
  it('bietet keine neuen Waffen mehr an, wenn der Guertel voll ist', () => {
    const s = stand()
    s.spieler.waffen = WAFFEN.slice(0, MAX_WAFFEN).map((def, i) => ruesteAus(def, i))

    for (let i = 0; i < 200; i++) {
      for (const k of zieheAngebote(s, 3)) expect(k.art).not.toBe('waffe')
    }
  })

  it('vergibt beim Aufheben den naechsten freien Platz', () => {
    // Der Platz ist zugleich das Riss-Bit. Zwei Waffen auf demselben Platz
    // wuerden als eine zaehlen und die Kernregel aushebeln.
    const s = stand()
    const karte = zieheAngebote(s, 3).find((k) => k.art === 'waffe')
    if (karte === undefined) return

    karte.anwenden(s)
    const plaetze = s.spieler.waffen.map((w) => w.platz)
    expect(new Set(plaetze).size).toBe(plaetze.length)
    expect(plaetze).toEqual(plaetze.map((_, i) => i))
  })

  it('nimmt nichts mehr auf, wenn der Guertel voll ist', () => {
    const s = stand()
    s.spieler.waffen = WAFFEN.slice(0, MAX_WAFFEN).map((def, i) => ruesteAus(def, i))
    const karte = zieheAngebote(stand(99), 3).find((k) => k.art === 'waffe')
    if (karte === undefined) return

    karte.anwenden(s)
    expect(s.spieler.waffen).toHaveLength(MAX_WAFFEN)
  })
})

describe('Waffenstufen', () => {
  it('bietet ausgereizte Waffen nicht mehr zum Aufwerten an', () => {
    const s = stand()
    const w = s.spieler.waffen[0]
    for (let i = 0; i < w.def.maxStufe; i++) werteAuf(w)

    for (let i = 0; i < 200; i++) {
      for (const k of zieheAngebote(s, 3)) {
        if (k.art === 'stufe') expect(k.name).not.toBe(w.def.name)
      }
    }
  })

  it('wertet die richtige Waffe auf', () => {
    const s = stand()
    s.spieler.waffen.push(ruesteAus(WAFFEN[1], 1))
    const vorher = s.spieler.waffen.map((w) => w.stufe)

    let karte = zieheAngebote(s, 3).find((k) => k.art === 'stufe')
    while (karte === undefined) karte = zieheAngebote(s, 3).find((k) => k.art === 'stufe')
    karte.anwenden(s)

    const nachher = s.spieler.waffen.map((w) => w.stufe)
    const gestiegen = nachher.filter((st, i) => st > vorher[i])
    expect(gestiegen).toHaveLength(1)
  })

  it('meldet die Vollendung auf der letzten Stufe', () => {
    const s = stand()
    const w = s.spieler.waffen[0]
    for (let i = 0; i < w.def.maxStufe - 2; i++) werteAuf(w)

    let karte = zieheAngebote(s, 3).find((k) => k.art === 'stufe' && k.name === w.def.name)
    for (let i = 0; i < 400 && karte === undefined; i++) {
      karte = zieheAngebote(s, 3).find((k) => k.art === 'stufe' && k.name === w.def.name)
    }
    expect(karte?.vollendung).toBe(true)
    expect(karte?.beschreibung).toBe(w.def.vollendung.text)
  })
})

describe('Seltenheit', () => {
  it('macht Legendäres selten, aber nicht unmoeglich', () => {
    // Die Spanne ist der Punkt: Ein Sternenschlucker soll ein Ereignis sein.
    // Kaeme er nie, waere er totes Gewicht in der Tabelle.
    let legendaer = 0
    let gewoehnlich = 0
    const runden = 4000

    for (let i = 0; i < runden; i++) {
      const s = stand(i + 1)
      for (const k of zieheAngebote(s, 3)) {
        if (k.art !== 'waffe') continue
        if (k.seltenheit === 'legendaer') legendaer++
        if (k.seltenheit === 'gewoehnlich') gewoehnlich++
      }
    }

    expect(legendaer).toBeGreaterThan(0)
    expect(gewoehnlich).toBeGreaterThan(legendaer * 3)
  })
})
