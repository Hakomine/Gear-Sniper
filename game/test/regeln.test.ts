import { describe, expect, it } from 'vitest'
import { Rng } from '../src/core/rng'
import { berechneSchaden, xpFuerLevel } from '../src/game/damage'
import { erzeugeSpieler } from '../src/game/player'
import { AUFWERTUNGEN, zieheAngebote } from '../src/game/upgrades'

describe('Schadensrechnung', () => {
  it('rechnet den Multiplikator ein', () => {
    const rng = new Rng(1)
    expect(berechneSchaden(10, 2, 0, 2, rng).wert).toBe(20)
  })

  it('faellt nie auf null', () => {
    // Ein Treffer, der nichts tut, liest sich als Fehler im Spiel - selbst
    // wenn die Rechnung stimmt.
    const rng = new Rng(1)
    expect(berechneSchaden(1, 0.01, 0, 2, rng).wert).toBe(1)
  })

  it('meldet nie einen Krit bei Chance null', () => {
    const rng = new Rng(5)
    for (let i = 0; i < 500; i++) {
      expect(berechneSchaden(10, 1, 0, 3, rng).krit).toBe(false)
    }
  })

  it('meldet immer einen Krit bei Chance eins und wendet den Faktor an', () => {
    const rng = new Rng(5)
    const treffer = berechneSchaden(10, 1, 1, 3, rng)
    expect(treffer.krit).toBe(true)
    expect(treffer.wert).toBe(30)
  })

  it('trifft die vorgegebene Kritrate ungefaehr', () => {
    const rng = new Rng(20260818)
    let krits = 0
    const laeufe = 20000
    for (let i = 0; i < laeufe; i++) {
      if (berechneSchaden(10, 1, 0.25, 2, rng).krit) krits++
    }
    expect(krits / laeufe).toBeGreaterThan(0.23)
    expect(krits / laeufe).toBeLessThan(0.27)
  })
})

describe('XP-Schwellen', () => {
  it('steigen streng monoton', () => {
    for (let level = 1; level < 200; level++) {
      expect(xpFuerLevel(level + 1)).toBeGreaterThan(xpFuerLevel(level))
    }
  })

  it('halten die erste Stufe billig', () => {
    // Der erste Levelup ist der Moment, in dem das Spiel zeigt, worum es
    // geht. Kommt er zu spaet, ist der Spieler weg.
    expect(xpFuerLevel(1)).toBeLessThanOrEqual(10)
  })
})

describe('Aufwertungen ziehen', () => {
  it('liefert nie dieselbe Karte zweimal', () => {
    const rng = new Rng(3)
    const sp = erzeugeSpieler()
    for (let i = 0; i < 300; i++) {
      const angebote = zieheAngebote(rng, new Map(), sp, 3)
      const ids = new Set(angebote.map((a) => a.id))
      expect(ids.size).toBe(angebote.length)
    }
  })

  it('bietet ausgereizte Aufwertungen nicht mehr an', () => {
    const rng = new Rng(4)
    const sp = erzeugeSpieler()
    const stufen = new Map<string, number>()
    for (const a of AUFWERTUNGEN) {
      if (Number.isFinite(a.maxStufe)) stufen.set(a.id, a.maxStufe)
    }
    // Uebrig bleibt nur die unbegrenzte Reparatur - und die nur bei Schaden.
    sp.hp = sp.maxHp * 0.5
    const angebote = zieheAngebote(rng, stufen, sp, 3)
    expect(angebote.map((a) => a.id)).toEqual(['reparatur'])
  })

  it('bietet Heilung bei vollem Leben nicht an', () => {
    const rng = new Rng(5)
    const sp = erzeugeSpieler()
    for (let i = 0; i < 200; i++) {
      const angebote = zieheAngebote(rng, new Map(), sp, 3)
      expect(angebote.some((a) => a.id === 'reparatur')).toBe(false)
    }
  })

  it('gibt lieber weniger Karten als Blindkarten', () => {
    const rng = new Rng(6)
    const sp = erzeugeSpieler()
    const stufen = new Map<string, number>()
    for (const a of AUFWERTUNGEN) {
      if (a.id !== 'wucht' && Number.isFinite(a.maxStufe)) stufen.set(a.id, a.maxStufe)
    }
    const angebote = zieheAngebote(rng, stufen, sp, 3)
    expect(angebote).toHaveLength(1)
    expect(angebote[0].id).toBe('wucht')
  })

  it('zieht bei gleichem Saatwert dieselben Karten', () => {
    const sp = erzeugeSpieler()
    const a = zieheAngebote(new Rng(77), new Map(), sp, 3).map((x) => x.id)
    const b = zieheAngebote(new Rng(77), new Map(), sp, 3).map((x) => x.id)
    expect(a).toEqual(b)
  })
})

describe('Aufwertungen wirken', () => {
  it('veraendern genau die Werte, die sie versprechen', () => {
    const sp = erzeugeSpieler()
    const vorher = sp.schadenMult
    AUFWERTUNGEN.find((a) => a.id === 'wucht')!.anwenden(sp)
    expect(sp.schadenMult).toBeCloseTo(vorher + 0.25)
  })

  it('halten die Abklingzeit auch voll ausgereizt ueber null', () => {
    // Multiplikativ statt additiv - sonst kaeme die Waffe dem Nullpunkt
    // gefaehrlich nahe und die Schleife wuerde pro Tick fluten.
    const sp = erzeugeSpieler()
    const taktung = AUFWERTUNGEN.find((a) => a.id === 'taktung')!
    for (let i = 0; i < taktung.maxStufe; i++) taktung.anwenden(sp)
    expect(sp.abklingMult).toBeGreaterThan(0.3)
    expect(sp.abklingMult).toBeLessThan(1)
  })

  it('heilen nie ueber das Maximum hinaus', () => {
    const sp = erzeugeSpieler()
    sp.hp = sp.maxHp - 5
    AUFWERTUNGEN.find((a) => a.id === 'panzerung')!.anwenden(sp)
    expect(sp.hp).toBeLessThanOrEqual(sp.maxHp)
  })
})
