import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { legeGegner } from '../src/game/spawner'
import type { Gegner, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, starteLauf } from '../src/game/state'
import { VERHALTEN } from '../src/game/verhalten'
import { ruesteAus, WAFFEN, waffeMit } from '../src/game/weapons'
import { FROST_PLATZ, verletzeGegner } from '../src/game/welt'

/**
 * Die zwölf Waffen aus Runde fünf.
 *
 * Der Anlass war "es gibt zu wenige kreative Waffen". Der Anspruch dabei: Jede
 * soll etwas tun, das keine andere tut. Genau das prüfen diese Tests - nicht,
 * ob eine Zahl stimmt, sondern ob die *Regel* greift.
 */

function feld(saat = 5): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  s.schreine.alleFreigeben()
  s.spieler.waffen = []
  gitterAufbauen(s)
  return s
}

function ruesteMit(s: Spielstand, id: string, stufe = 1) {
  const def = waffeMit(id)
  if (def === undefined) throw new Error(`Waffe ${id} fehlt`)
  const w = ruesteAus(def, 0)
  w.stufe = stufe
  s.spieler.waffen = [w]
  return w
}

function setze(s: Spielstand, x: number, y: number, hp = 1e6, art = 0): Gegner {
  const g = legeGegner(s, GEGNER_ARTEN[art], x, y)
  if (g === null) throw new Error('kein Gegner')
  g.hp = hp
  g.maxHp = hp
  return g
}

function feuere(s: Spielstand, w: ReturnType<typeof ruesteMit>): boolean {
  gitterAufbauen(s)
  return VERHALTEN[w.def.verhalten].feuern?.(s, w) ?? false
}

function dauernd(s: Spielstand, w: ReturnType<typeof ruesteMit>, dt = TICK_DT): void {
  gitterAufbauen(s)
  VERHALTEN[w.def.verhalten].dauernd?.(s, w, dt)
}

describe('Jede neue Waffe ist eine eigene Idee', () => {
  it('teilt sich kein Verhalten mit einer anderen', () => {
    // Wenn zwei Waffen dasselbe Verhalten tragen, sind es zwei Zahlensaetze
    // und keine zwei Waffen. Genau das war der Vorwurf.
    const zaehler = new Map<string, number>()
    for (const def of WAFFEN) zaehler.set(def.verhalten, (zaehler.get(def.verhalten) ?? 0) + 1)
    for (const [id, anzahl] of zaehler) expect(anzahl, id).toBe(1)
  })

  it('bringt den Waffenkasten auf mindestens zwanzig', () => {
    expect(WAFFEN.length).toBeGreaterThanOrEqual(20)
  })
})

describe('Schleifband', () => {
  it('legt eine Spur, wo der Spieler steht', () => {
    const s = feld()
    const w = ruesteMit(s, 'schleifband')
    expect(s.zonen.anzahl).toBe(0)

    w.merkZeit = 0
    dauernd(s, w)
    expect(s.zonen.anzahl).toBe(1)
    const z = s.zonen.aktiv[0]
    expect(z.x).toBeCloseTo(s.spieler.x, 5)
    expect(z.platz).toBe(w.platz)
  })
})

describe('Stimmgabel', () => {
  it('trifft Schnelle härter als Langsame', () => {
    const s = feld()
    const w = ruesteMit(s, 'stimmgabel')

    const schnell = setze(s, 40, 0)
    schnell.tempo = 200
    const langsam = setze(s, -40, 0)
    langsam.tempo = 30

    const vorherSchnell = schnell.hp
    const vorherLangsam = langsam.hp
    expect(feuere(s, w)).toBe(true)

    expect(vorherSchnell - schnell.hp).toBeGreaterThan(vorherLangsam - langsam.hp)
  })
})

describe('Fadenkreuz', () => {
  it('sucht sich den zähesten Gegner, nicht den nächsten', () => {
    const s = feld()
    const w = ruesteMit(s, 'fadenkreuz')
    const nah = setze(s, 30, 0, 50)
    const zaeh = setze(s, 300, 0, 900)

    const vorherNah = nah.hp
    dauernd(s, w)
    expect(nah.hp).toBe(vorherNah)
    expect(zaeh.hp).toBeLessThan(900)
    expect(w.merkId).toBe(zaeh.id)
  })

  it('lädt sich auf, solange das Ziel dasselbe bleibt', () => {
    const s = feld()
    const w = ruesteMit(s, 'fadenkreuz')
    setze(s, 200, 0, 1e9)

    for (let i = 0; i < 40; i++) dauernd(s, w)
    expect(w.merkZeit).toBeGreaterThan(0.5)
  })
})

describe('Spiegelscherbe', () => {
  it('macht aus einem Feindgeschoss ein eigenes', () => {
    const s = feld()
    const w = ruesteMit(s, 'spiegel')
    const f = s.feindSchuesse.nimm()
    f.x = s.spieler.x + 20
    f.y = s.spieler.y
    f.vx = -100
    f.vy = 0
    f.radius = 6
    f.schaden = 20
    f.leben = 3
    f.farbe = '#fff'

    expect(s.geschosse.anzahl).toBe(0)
    dauernd(s, w)
    expect(s.feindSchuesse.anzahl).toBe(0)
    expect(s.geschosse.anzahl).toBe(1)
    // Zurueck, woher es kam.
    expect(s.geschosse.aktiv[0].vx).toBeGreaterThan(0)
  })

  it('lässt weit entfernte Geschosse in Ruhe', () => {
    const s = feld()
    const w = ruesteMit(s, 'spiegel')
    const f = s.feindSchuesse.nimm()
    f.x = s.spieler.x + 900
    f.y = s.spieler.y
    f.vx = -100
    f.vy = 0
    f.radius = 6
    f.schaden = 20
    f.leben = 3
    f.farbe = '#fff'

    dauernd(s, w)
    expect(s.feindSchuesse.anzahl).toBe(1)
    expect(s.geschosse.anzahl).toBe(0)
  })
})

describe('Frostkeil', () => {
  it('vereist und senkt damit die Riss-Schwelle', () => {
    const s = feld()
    const w = ruesteMit(s, 'frost')
    const g = setze(s, 120, 0)

    expect(feuere(s, w)).toBe(true)
    expect(g.frost).toBeGreaterThan(0)
    // Der Frost-Riss zaehlt zusaetzlich - der Treffer selbst hat einen
    // gesetzt, die Vereisung den zweiten.
    expect(g.risseMaske & (1 << FROST_PLATZ)).not.toBe(0)
    expect(g.risse).toBe(2)
  })

  it('lässt Gefrorenes mit zwei Waffen zerspringen', () => {
    const s = feld()
    const g = setze(s, 0, 0)
    g.frost = 3

    verletzeGegner(s, g, 1, 0, false, 0, 0)
    verletzeGegner(s, g, 1, 1, false, 0, 0)
    expect(g.zersplittert).toBe(true)
  })
})

describe('Ankerhaken', () => {
  it('zieht den entferntesten Gegner heran, nicht den nächsten', () => {
    const s = feld()
    const w = ruesteMit(s, 'anker')
    const nah = setze(s, 60, 0)
    const fern = setze(s, 500, 0)

    expect(feuere(s, w)).toBe(true)
    // Der Ferne bekommt einen Stoss zum Spieler hin, der Nahe nicht.
    expect(fern.stossX).toBeLessThan(0)
    expect(nah.stossX).toBe(0)
  })
})

describe('Bohrkopf', () => {
  it('bleibt an seinem Opfer und erneuert dessen Riss', () => {
    const s = feld()
    const w = ruesteMit(s, 'bohrkopf')
    const g = setze(s, 100, 0)

    dauernd(s, w)
    expect(w.merkId).toBe(g.id)
    expect(g.risse).toBe(1)

    // Riss laufen lassen und weiterbohren: Er kommt wieder.
    g.risseMaske = 0
    g.risse = 0
    w.merkZeit = 0
    dauernd(s, w)
    expect(g.risse).toBe(1)
  })
})

describe('Glockenturm', () => {
  it('reisst alles im Bild auf einmal an', () => {
    const s = feld()
    const w = ruesteMit(s, 'glocke')
    const a = setze(s, 200, 0)
    const b = setze(s, -300, 120)
    const c = setze(s, 0, 400)

    expect(feuere(s, w)).toBe(true)
    expect(a.risse).toBe(1)
    expect(b.risse).toBe(1)
    expect(c.risse).toBe(1)
  })
})

describe('Schwarzband', () => {
  it('trifft, was zwischen den beiden Enden steht', () => {
    const s = feld()
    const w = ruesteMit(s, 'schwarzband')
    const nah = setze(s, 60, 0)
    const mitte = setze(s, 260, 0)
    const fern = setze(s, 500, 0)
    const daneben = setze(s, 260, 400)

    const vorher = daneben.hp
    expect(feuere(s, w)).toBe(true)
    expect(mitte.hp).toBeLessThan(1e6)
    expect(nah.hp).toBeLessThan(1e6)
    expect(fern.hp).toBeLessThan(1e6)
    // Wer weit neben der Linie steht, bleibt verschont.
    expect(daneben.hp).toBe(vorher)
  })
})

describe('Kaleidoskop', () => {
  it('tut nichts, wenn es allein im Gürtel liegt', () => {
    const s = feld()
    const w = ruesteMit(s, 'kaleidoskop')
    setze(s, 100, 0)
    expect(feuere(s, w)).toBe(false)
  })

  it('löst eine andere Waffe aus, ohne deren Schaden zu behalten', () => {
    const s = feld()
    const kal = ruesteMit(s, 'kaleidoskop')
    const splitter = waffeMit('splitter')
    if (splitter === undefined) throw new Error('Startwaffe fehlt')
    s.spieler.waffen.push(ruesteAus(splitter, 1))
    setze(s, 100, 0)

    const vorher = s.spieler.schadenMult
    expect(feuere(s, kal)).toBe(true)
    expect(s.geschosse.anzahl).toBeGreaterThan(0)
    // Der gesenkte Schadensfaktor gilt nur fuer diesen einen Schuss.
    expect(s.spieler.schadenMult).toBe(vorher)
    // Und der Riss gehoert der gespiegelten Waffe, nicht dem Kaleidoskop.
    expect(s.geschosse.aktiv[0].platz).toBe(1)
  })
})

describe('Sanduhr', () => {
  it('stösst Gegner weg und kehrt Feindgeschosse um', () => {
    const s = feld()
    const w = ruesteMit(s, 'sanduhr')
    const g = setze(s, 80, 0)
    const f = s.feindSchuesse.nimm()
    f.x = s.spieler.x + 30
    f.y = s.spieler.y
    f.vx = -200
    f.vy = 0
    f.radius = 6
    f.schaden = 10
    f.leben = 3
    f.farbe = '#fff'

    expect(feuere(s, w)).toBe(true)
    expect(g.stossX).toBeGreaterThan(0)
    expect(f.vx).toBeGreaterThan(0)
  })
})
