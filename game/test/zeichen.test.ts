import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import type { GegnerArt } from '../src/game/enemies'
import { RISS_FENSTER } from '../src/game/risse'
import { legeGegner } from '../src/game/spawner'
import type { Gegner, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, leereBefehle, starteLauf, tick } from '../src/game/state'
import {
  MAX_GEZEICHNET,
  OHNE_ZEICHEN,
  setzeZeichen,
  waehleZeichen,
  ZEICHEN,
  zeichenAnteil,
} from '../src/game/zeichen'

/**
 * Zeichen.
 *
 * Neun Arten mal fuenf Zeichen sind nur dann fuenfundvierzig Begegnungen,
 * wenn jedes Zeichen wirklich etwas *anderes* tut. Diese Datei haelt beides
 * fest: dass sie wirken, und dass der Zaehler, an dem der Deckel haengt, nicht
 * auseinanderlaeuft.
 */

function leeresFeld(saat = 11): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  s.gezeichnet = 0
  // Ohne Waffen: Sonst setzt der Splitterwerfer waehrend des Tests Risse und
  // toetet die Gegner, um die es gerade geht.
  s.spieler.waffen = []
  gitterAufbauen(s)
  return s
}

function artMit(id: string): GegnerArt {
  const a = GEGNER_ARTEN.find((x) => x.id === id)
  if (a === undefined) throw new Error(`Art ${id} fehlt`)
  return a
}

function index(id: string): number {
  const i = ZEICHEN.findIndex((z) => z.id === id)
  if (i < 0) throw new Error(`Zeichen ${id} fehlt`)
  return i
}

function setze(s: Spielstand, artId: string, zeichenId: string, x = 0, y = 0): Gegner {
  const g = legeGegner(s, artMit(artId), x, y)
  if (g === null) throw new Error('kein Platz im Pool')
  setzeZeichen(s, g, index(zeichenId))
  return g
}

describe('Die Zeichen sind wirklich verschieden', () => {
  it('hat fuenf Zeichen, alle mit eigener Farbe und eigenem Namen', () => {
    expect(ZEICHEN.length).toBe(5)
    expect(new Set(ZEICHEN.map((z) => z.farbe)).size).toBe(5)
    expect(new Set(ZEICHEN.map((z) => z.id)).size).toBe(5)
  })

  it('gibt keinem Zeichen dieselbe Wirkung wie einem anderen', () => {
    // Der ganze Zweck ist, dass man sie auseinanderhaelt. Zwei, die dasselbe
    // tun, sind eines mit zwei Farben - und genau der Fehler, den die neun
    // Gegnerarten in der Runde davor behoben haben.
    const ticks = ZEICHEN.map((z) => z.tick).filter((f) => f !== undefined)
    const tode = ZEICHEN.map((z) => z.beiTod).filter((f) => f !== undefined)
    expect(new Set(ticks).size).toBe(ticks.length)
    expect(new Set(tode).size).toBe(tode.length)
    // Und mindestens eines greift die Kernregel direkt an - das ist der Grund,
    // warum es Zeichen ueberhaupt gibt und nicht nur zaehere Gegner.
    expect(ZEICHEN.some((z) => z.rissZerfall !== 1)).toBe(true)
  })

  it('macht jedes Zeichen zu einem lohnenden Ziel statt zu einem Aergernis', () => {
    for (const z of ZEICHEN) {
      expect(z.hpFaktor).toBeGreaterThan(1.5)
      expect(z.xpFaktor).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('Was die einzelnen Zeichen tun', () => {
  it('Klammer: laesst ihre Risse deutlich schneller verfallen', () => {
    const s = leeresFeld()
    const klammer = setze(s, 'brocken', 'klammer', 60, 0)
    const blank = legeGegner(s, artMit('brocken'), -60, 0)
    if (blank === null) throw new Error('kein Platz')

    klammer.risseZeit = RISS_FENSTER
    klammer.risse = 2
    blank.risseZeit = RISS_FENSTER
    blank.risse = 2

    // Ein Fenster lang laufen lassen, aber nicht ganz: Der blanke muss seine
    // Risse behalten, die Klammer nicht.
    for (let i = 0; i < Math.round(RISS_FENSTER / TICK_DT) - 4; i++) tick(s, leereBefehle(), TICK_DT)

    expect(klammer.risse).toBe(0)
    expect(blank.risse).toBe(2)
  })

  it('Zunder: legt eine Brandspur, die den Spieler verletzt', () => {
    const s = leeresFeld()
    const g = setze(s, 'brocken', 'zunder', 40, 0)
    const vorher = s.zonen.anzahl

    for (let i = 0; i < 60; i++) tick(s, leereBefehle(), TICK_DT)

    expect(s.zonen.anzahl).toBeGreaterThan(vorher)
    const brand = s.zonen.aktiv.find((z) => z.art === 'brand')
    expect(brand).toBeDefined()
    expect(brand?.feindlich).toBe(true)
    expect(g.zeichen).toBe(index('zunder'))
  })

  it('Frostmal: bremst den Spieler, wenn es neben ihm platzt - und nur dann', () => {
    const nah = leeresFeld()
    const g = setze(nah, 'splitter', 'frostmal', nah.spieler.x + 20, nah.spieler.y)
    g.hp = 0
    g.tot = true
    tick(nah, leereBefehle(), TICK_DT)
    expect(nah.spieler.gebremst).toBeGreaterThan(0)

    const fern = leeresFeld()
    const f = setze(fern, 'splitter', 'frostmal', fern.spieler.x + 900, fern.spieler.y)
    f.hp = 0
    f.tot = true
    tick(fern, leereBefehle(), TICK_DT)
    expect(fern.spieler.gebremst).toBe(0)
  })

  it('Echo: hinterlaesst zwei Kopien, und die tragen kein Zeichen', () => {
    const s = leeresFeld()
    const g = setze(s, 'brocken', 'echo', 200, 0)
    g.hp = 0
    g.tot = true
    tick(s, leereBefehle(), TICK_DT)

    const kopien = s.gegner.aktiv.filter((k) => k.art.id === 'brocken')
    expect(kopien.length).toBe(2)
    // Sonst vervielfaeltigte sich ein Echo ueber seine eigenen Nachkommen.
    for (const k of kopien) expect(k.zeichen).toBe(OHNE_ZEICHEN)
  })

  it('Zieher: schiebt den stehenden Spieler zu sich hin', () => {
    const s = leeresFeld()
    const start = s.spieler.x
    setze(s, 'brocken', 'zieher', start + 200, s.spieler.y)

    for (let i = 0; i < 30; i++) tick(s, leereBefehle(), TICK_DT)

    expect(s.spieler.x).toBeGreaterThan(start)
  })

  it('Zieher: viele gleichzeitig ziehen nicht schneller, als man laufen kann', () => {
    const s = leeresFeld()
    const start = s.spieler.x
    for (let i = 0; i < 8; i++) setze(s, 'brocken', 'zieher', start + 260, s.spieler.y + i * 4)

    for (let i = 0; i < 60; i++) tick(s, leereBefehle(), TICK_DT)

    // Ein Gegner, gegen den es keine Handlung gibt, ist keine Herausforderung,
    // sondern eine Strafe: Der gesammelte Zug bleibt unter dem Lauftempo.
    const gewandert = s.spieler.x - start
    expect(gewandert).toBeLessThan(s.spieler.tempo * 1.0)
  })

  it('Der Stoss reisst sich vom Zieher los', () => {
    const s = leeresFeld()
    s.spieler.zugX = 500
    s.spieler.zugY = 0
    s.spieler.stossRest = 0.1
    s.spieler.stossVx = -400
    s.spieler.stossVy = 0
    const vorher = s.spieler.x
    tick(s, leereBefehle(), TICK_DT)
    expect(s.spieler.x).toBeLessThan(vorher)
    expect(s.spieler.zugX).toBe(0)
  })
})

describe('Anteil und Deckel', () => {
  it('setzt kein Zeichen mehr, sobald der Deckel erreicht ist', () => {
    const s = leeresFeld()
    s.gezeichnet = MAX_GEZEICHNET
    for (let i = 0; i < 200; i++) expect(waehleZeichen(s)).toBe(OHNE_ZEICHEN)
  })

  it('laesst den Anteil mit der Etappe steigen und deckelt ihn', () => {
    const s = leeresFeld()
    s.etappe = 1
    const frueh = zeichenAnteil(s)
    s.etappe = 5
    const spaet = zeichenAnteil(s)
    expect(spaet).toBeGreaterThan(frueh)

    s.etappe = 400
    expect(zeichenAnteil(s)).toBeLessThanOrEqual(0.23)
  })

  it('haelt den Zaehler ueber einen ganzen Lauf hinweg in Deckung', () => {
    /*
     * Der wichtigste Test der Datei.
     *
     * Am Zaehler haengt der Deckel. Laeuft er nach oben aus dem Ruder, gibt es
     * irgendwann gar keine Zeichen mehr; laeuft er nach unten, gibt es
     * beliebig viele. Beides waere im Spiel unsichtbar und erst an einer
     * eingebrochenen Bildrate zu merken - also genau die Sorte Fehler, die ein
     * Test finden muss.
     */
    const s = erzeugeSpielstand(7)
    starteLauf(s, 7)
    s.etappe = 4
    const b = leereBefehle()
    for (let i = 0; i < 60 * 25; i++) {
      b.x = Math.sin(i / 40)
      b.y = Math.cos(i / 55)
      tick(s, b, TICK_DT)
      if (s.phase !== 'laufend') break
    }

    const wirklich = s.gegner.aktiv.filter((g) => g.zeichen >= 0).length
    expect(s.gezeichnet).toBe(wirklich)
    expect(s.gezeichnet).toBeLessThanOrEqual(MAX_GEZEICHNET)
    // Und es soll ueberhaupt welche gegeben haben - ein Test, der nur die
    // Null bestaetigt, prueft nichts.
    expect(wirklich).toBeGreaterThan(0)
  })

  it('zieht bei gleicher Saat dieselben Zeichen', () => {
    const lauf = (): number[] => {
      const s = erzeugeSpielstand(21)
      starteLauf(s, 21)
      s.etappe = 5
      for (let i = 0; i < 60 * 12; i++) tick(s, leereBefehle(), TICK_DT)
      return s.gegner.aktiv.map((g) => g.zeichen)
    }
    expect(lauf()).toEqual(lauf())
  })
})
