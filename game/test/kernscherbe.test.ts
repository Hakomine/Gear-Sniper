import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { charakterMit, freigeschaltetDurch } from '../src/game/charaktere'
import { artIndex, GEGNER_ARTEN, QUELLE_BOSS, QUELLE_UMWELT } from '../src/game/enemies'
import { erzeugeSpieler } from '../src/game/player'
import { GLAS_FENSTER, RISS_SCHWELLE } from '../src/game/risse'
import { legeGegner } from '../src/game/spawner'
import type { Gegner, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, leereBefehle, starteLauf, tick } from '../src/game/state'

/**
 * Die Kernscherbe.
 *
 * Der einzige Ort im Spiel, an dem die Kernregel gegen den Spieler laeuft.
 * Diese Datei haelt fest, dass sie *drei verschiedene* Quellen verlangt - denn
 * genau daran haengt, ob der Charakter eine Gefahr ist, die mit dem Lauf
 * waechst, oder nur eine feste Steuer auf jeden Treffer.
 */

function glasLauf(saat = 4): Spielstand {
  const s = erzeugeSpielstand(saat)
  s.offen.push('kernscherbe')
  starteLauf(s, saat, charakterMit('kernscherbe'))
  s.gegner.alleFreigeben()
  s.gezeichnet = 0
  s.spieler.waffen = []
  /*
   * Keine Erfahrung.
   *
   * Sonst raeumt der erste getoetete Gegner einen Kristall ab, der Spieler
   * steigt auf, und ab da steht das Spiel im Kartenmenue - `tick` laeuft dann
   * gar nicht mehr durch die Simulation. Genau daran ist dieser Test zuerst
   * gescheitert, und es sah aus wie ein Fehler in der Kernscherbe.
   */
  s.spieler.xpMult = 0
  gitterAufbauen(s)
  return s
}

function setze(s: Spielstand, artId: string, x: number, y: number): Gegner {
  const art = GEGNER_ARTEN.find((a) => a.id === artId)
  if (art === undefined) throw new Error(`Art ${artId} fehlt`)
  const g = legeGegner(s, art, x, y)
  if (g === null) throw new Error('kein Platz im Pool')
  return g
}

/**
 * Einen Gegner der genannten Art auf den Spieler setzen und so lange ticken,
 * bis er wirklich getroffen hat - der Treffer geht nur durch, wenn die
 * Unverwundbarkeit abgelaufen ist.
 */
function lassTreffen(s: Spielstand, artId: string): void {
  const g = setze(s, artId, s.spieler.x, s.spieler.y)
  g.schaden = 1
  const hpVorher = s.spieler.hp
  const risseVorher = s.spieler.risse

  // Bis der Treffer wirklich durchgeht: Nach dem letzten ist der Spieler noch
  // eine gute halbe Sekunde unverwundbar, und `unverwundbar > 0` als
  // Abbruchbedingung hiesse, dass der zweite Aufruf sofort wieder herausfaellt,
  // ohne dass etwas passiert ist.
  for (let i = 0; i < 200; i++) {
    g.x = s.spieler.x
    g.y = s.spieler.y
    gitterAufbauen(s)
    tick(s, leereBefehle(), TICK_DT)
    if (s.spieler.hp < hpVorher || s.spieler.risse !== risseVorher) break
  }
  g.tot = true
  g.hp = 0
  tick(s, leereBefehle(), TICK_DT)
}

describe('Sie ist selbst aus Glas', () => {
  it('setzt nur bei ihr Risse, bei niemandem sonst', () => {
    for (const id of ['splitter', 'riss', 'koloss', 'kernscherbe']) {
      const sp = erzeugeSpieler()
      charakterMit(id).anwenden(sp, { next: () => 0.5, pick: <T,>(a: readonly T[]) => a[0] } as never)
      expect(sp.istGlas, id).toBe(id === 'kernscherbe')
    }
  })

  it('zersplittert bei drei verschiedenen Gegnerarten', () => {
    const s = glasLauf()
    const voll = s.spieler.maxHp
    lassTreffen(s, 'splitter')
    expect(s.spieler.risse).toBe(1)
    lassTreffen(s, 'brocken')
    expect(s.spieler.risse).toBe(2)
    lassTreffen(s, 'schwaermer')

    // Der dritte loest aus: Risse weg, ein Fuenftel Leben weg.
    expect(s.spieler.risse).toBe(0)
    expect(s.spieler.hp).toBeLessThan(voll * 0.75)
  })

  it('zersplittert *nicht* an dreimal derselben Art', () => {
    const s = glasLauf()
    for (let i = 0; i < 3; i++) lassTreffen(s, 'splitter')
    // Ein Feld aus lauter Splittern soll sie nicht umbringen - die Mechanik
    // greift erst, wenn das Feld gemischt ist.
    expect(s.spieler.risse).toBe(1)
    expect(s.spieler.hp).toBeGreaterThan(s.spieler.maxHp * 0.75)
  })

  it('reisst beim Zersplittern alles im Umkreis auf und schleudert es weg', () => {
    const s = glasLauf()
    const nachbar = setze(s, 'brocken', s.spieler.x + 120, s.spieler.y)
    nachbar.hp = 1e6
    nachbar.maxHp = 1e6

    lassTreffen(s, 'splitter')
    lassTreffen(s, 'stuermer')
    const rissVorher = nachbar.risse
    lassTreffen(s, 'speier')

    // Ihre Schwaeche ist zugleich ihre staerkste Waffe.
    expect(nachbar.risse).toBeGreaterThan(rissVorher)
    expect(Math.hypot(nachbar.stossX, nachbar.stossY)).toBeGreaterThan(0)
  })

  it('laesst ihre Risse nach dem Fenster verfallen', () => {
    const s = glasLauf()
    lassTreffen(s, 'splitter')
    expect(s.spieler.risse).toBe(1)

    for (let i = 0; i < Math.ceil((GLAS_FENSTER + 0.5) / TICK_DT); i++) {
      s.gegner.alleFreigeben()
      gitterAufbauen(s)
      tick(s, leereBefehle(), TICK_DT)
    }
    expect(s.spieler.risse).toBe(0)
  })

  it('haelt sie laenger als ein Gegner seine haelt', () => {
    // Nach einem Treffer ist der Spieler 0,55 s unverwundbar; mit dem Fenster
    // eines Gegners waere die Mechanik nur durch pures Pech zu sehen.
    expect(GLAS_FENSTER).toBeGreaterThan(2)
  })
})

describe('Woher ein Treffer kam', () => {
  it('gibt jeder Gegnerart eine eigene Nummer', () => {
    const nummern = GEGNER_ARTEN.map((a) => artIndex(a))
    expect(new Set(nummern).size).toBe(GEGNER_ARTEN.length)
  })

  it('trennt Gegner, Bosse und Umwelt voneinander', () => {
    for (const a of GEGNER_ARTEN) {
      expect(artIndex(a)).not.toBe(QUELLE_BOSS)
      expect(artIndex(a)).not.toBe(QUELLE_UMWELT)
    }
    expect(QUELLE_BOSS).not.toBe(QUELLE_UMWELT)
  })

  it('gibt einer Bossart, die nicht in der Liste steht, die Boss-Nummer', () => {
    const erfunden = { ...GEGNER_ARTEN[0], id: 'boss:erfunden' }
    expect(artIndex(erfunden)).toBe(QUELLE_BOSS)
  })

  it('braucht mehr Quellen, als die Schwelle verlangt', () => {
    // Sonst gaebe es Feldzustaende, in denen die Mechanik gar nicht ausloesen
    // *kann* - und eine Regel, die nie greift, ist keine.
    expect(GEGNER_ARTEN.length).toBeGreaterThan(RISS_SCHWELLE)
  })
})

describe('Der Handel und die Freischaltung', () => {
  it('zahlt ihren Preis auch in den Zahlen, nicht nur im Text', () => {
    const grund = erzeugeSpieler()
    const glas = erzeugeSpieler()
    charakterMit('kernscherbe').anwenden(glas, { next: () => 0.5 } as never)
    expect(glas.maxHp).toBeLessThan(grund.maxHp)
    expect(glas.schadenMult).toBeGreaterThan(grund.schadenMult)
    expect(glas.rissDauer).toBeGreaterThan(grund.rissDauer)
  })

  it('oeffnet sich nur durch einen Sieg ueber den Kern', () => {
    const sp = erzeugeSpieler()
    const st = {
      kills: 999_999,
      level: 99,
      zeit: 9999,
      schaden: 0,
      zersplittert: 9999,
      bosse: 99,
      kernGelegt: false,
      schadenProPlatz: [],
      platzName: [],
      platzFarbe: [],
    }
    // Alles andere im Uebermass - und sie bleibt zu.
    expect(freigeschaltetDurch(st, sp)).not.toContain('kernscherbe')
    st.kernGelegt = true
    expect(freigeschaltetDurch(st, sp)).toContain('kernscherbe')
  })
})
