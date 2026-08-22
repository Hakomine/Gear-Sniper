import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { tagesSaat } from '../src/core/rng'
import { CHRONIK_MAX, leseChronik, trageEin } from '../src/game/chronik'
import type { Eintrag } from '../src/game/chronik'
import {
  beendeLauf,
  erzeugeSpielstand,
  leereBefehle,
  starteLauf,
  starteTageslauf,
  tick,
} from '../src/game/state'

/**
 * Chronik und Tagesscherbe.
 *
 * Die Chronik ist das erste, was einen Lauf ueberdauert und *keine* Zahl im
 * Spiel ist. Genau darauf achtet diese Datei: Sie bleibt Aufzeichnung, nie
 * Rechenkraft.
 */

function eintrag(punkte: number, rest: Partial<Eintrag> = {}): Eintrag {
  return {
    punkte,
    charakter: 'splitter',
    etappe: 1,
    zerruettung: 0,
    verhexungen: [],
    zeit: 60,
    gewonnen: false,
    saat: 1,
    tag: false,
    ...rest,
  }
}

describe('Die Liste', () => {
  it('sortiert absteigend und deckelt bei zehn', () => {
    let c: Eintrag[] = []
    for (let i = 1; i <= 25; i++) c = trageEin(c, eintrag(i * 100))
    expect(c.length).toBe(CHRONIK_MAX)
    expect(c[0].punkte).toBe(2500)
    for (let i = 1; i < c.length; i++) expect(c[i].punkte).toBeLessThanOrEqual(c[i - 1].punkte)
  })

  it('bevorzugt den letzten Lauf nicht', () => {
    let c: Eintrag[] = []
    for (let i = 0; i < CHRONIK_MAX; i++) c = trageEin(c, eintrag(9000 + i))
    c = trageEin(c, eintrag(5))
    // Der frische Eintrag ist zu schwach - er faellt heraus wie jeder andere.
    expect(c.some((e) => e.punkte === 5)).toBe(false)
    expect(c.length).toBe(CHRONIK_MAX)
  })

  it('ueberlebt kaputte, fremde und halbe Eintraege', () => {
    const roh = [
      null,
      42,
      'was',
      { punkte: 'viel' },
      { punkte: 500, charakter: 'gibtsnicht', verhexungen: ['unfug', 'hast'] },
      { punkte: 900, charakter: 'riss', etappe: 4, zerruettung: 1, gewonnen: true },
    ]
    const c = leseChronik(roh)
    expect(c.length).toBe(2)
    expect(c[0].punkte).toBe(900)
    expect(c[0].charakter).toBe('riss')
    expect(c[0].gewonnen).toBe(true)
    // Der unbekannte Charakter wird ersetzt, die unbekannte Verhexung fliegt.
    expect(c[1].charakter).toBe('?')
    expect(c[1].verhexungen).toEqual(['hast'])
  })

  it('macht aus Unsinn eine leere Liste statt eines Absturzes', () => {
    expect(leseChronik(undefined)).toEqual([])
    expect(leseChronik('kaputt')).toEqual([])
    expect(leseChronik({ nicht: 'array' })).toEqual([])
  })
})

describe('Was ein Lauf hinterlaesst', () => {
  it('traegt sich beim Ende mit seiner ganzen Geschichte ein', () => {
    const s = erzeugeSpielstand(17)
    s.verhexungen = ['hast', 'enge']
    starteLauf(s, 17)
    s.zerruettung = 2
    s.etappe = 5
    s.gewonnen = true
    beendeLauf(s)

    expect(s.chronik.length).toBe(1)
    const e = s.chronik[0]
    expect(e.punkte).toBe(s.punkte)
    expect(e.charakter).toBe(s.charakter.id)
    expect(e.etappe).toBe(5)
    expect(e.zerruettung).toBe(2)
    expect(e.verhexungen).toEqual(['hast', 'enge'])
    expect(e.gewonnen).toBe(true)
  })

  it('zaehlt jeden Eintrag mit, auch wenn die Liste voll ist', () => {
    /*
     * Ohne den Zaehler prueft `main.ts` die Laenge - und die steht ab dem
     * zehnten Lauf fest. Der elfte waere still nicht gespeichert worden.
     */
    const s = erzeugeSpielstand(17)
    for (let i = 0; i < CHRONIK_MAX + 5; i++) {
      starteLauf(s, 17)
      beendeLauf(s)
    }
    expect(s.chronik.length).toBe(CHRONIK_MAX)
    expect(s.chronikZaehler).toBe(CHRONIK_MAX + 5)
  })

  it('bleibt reine Aufzeichnung - kein Eintrag macht den naechsten Lauf leichter', () => {
    const s = erzeugeSpielstand(17)
    starteLauf(s, 17)
    const frisch = {
      hp: s.spieler.maxHp,
      waffen: s.spieler.maxWaffen,
      schaden: s.spieler.schadenMult,
      tempo: s.spieler.tempoMult,
    }
    for (let i = 0; i < 12; i++) {
      starteLauf(s, 17)
      s.punkte = 99999
      beendeLauf(s)
    }
    starteLauf(s, 17)
    expect(s.spieler.maxHp).toBe(frisch.hp)
    expect(s.spieler.maxWaffen).toBe(frisch.waffen)
    expect(s.spieler.schadenMult).toBe(frisch.schaden)
    expect(s.spieler.tempoMult).toBe(frisch.tempo)
  })
})

describe('Die Tagesscherbe', () => {
  it('laeuft auf dem Saatwert des Tages und merkt sich den Versuch', () => {
    const s = erzeugeSpielstand(1)
    starteTageslauf(s)
    expect(s.saat).toBe(tagesSaat())
    expect(s.tagesLauf).toBe(true)
    // Beim *Start* gemerkt, nicht am Ende - sonst waere Aufgeben ein
    // Freiversuch.
    expect(s.tagStand).toBe(tagesSaat())
  })

  it('gibt genau einen Versuch pro Tag', () => {
    const s = erzeugeSpielstand(1)
    const b = leereBefehle()
    b.tag = true
    tick(s, b, TICK_DT)
    expect(s.phase).toBe('laufend')

    beendeLauf(s)
    s.phase = 'titel'
    tick(s, b, TICK_DT)
    // Kein zweiter Versuch: Das Titelbild bleibt stehen.
    expect(s.phase).toBe('titel')
  })

  it('ergibt bei gleichem Tag denselben Lauf fuer alle', () => {
    const zustand = (): string => {
      const s = erzeugeSpielstand(999)
      starteTageslauf(s)
      for (let i = 0; i < 60 * 8; i++) tick(s, leereBefehle(), TICK_DT)
      return s.gegner.aktiv.map((g) => `${g.art.id}:${Math.round(g.x)}`).join('|')
    }
    expect(zustand()).toBe(zustand())
  })

  it('markiert den Eintrag als Tageslauf', () => {
    const s = erzeugeSpielstand(1)
    starteTageslauf(s)
    beendeLauf(s)
    expect(s.chronik[0].tag).toBe(true)
  })

  it('ist ein gewoehnlicher Lauf nie', () => {
    const s = erzeugeSpielstand(1)
    starteLauf(s, 5)
    beendeLauf(s)
    expect(s.chronik[0].tag).toBe(false)
  })
})
