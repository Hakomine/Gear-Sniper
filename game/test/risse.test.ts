import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import {
  KASKADE_MAX_TIEFE,
  RISS_BONUS,
  RISS_FENSTER,
  RISS_SCHWELLE,
  rissBonus,
  risseAblaufen,
  rissSetzen,
  zersplitterBereit,
} from '../src/game/risse'
import { legeGegner } from '../src/game/spawner'
import type { Gegner, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, starteLauf } from '../src/game/state'
import { arbeiteKaskadeAb, verletzeGegner } from '../src/game/welt'

/**
 * Die eigene Regel des Spiels: Nur *verschiedene* Waffen reissen einen Gegner
 * auf, drei Risse lassen ihn zerspringen. Faellt einer dieser Tests, ist der
 * Anreiz weg, einen gemischten Bau zu spielen - und damit der Kern.
 */

function frischerStand(): Spielstand {
  const s = erzeugeSpielstand(4242)
  starteLauf(s, 4242)
  // Die Startwelle stoert die Zaehlungen - fuer diese Tests soll das Feld
  // leer sein.
  s.gegner.alleFreigeben()
  return s
}

function setzeGegner(s: Spielstand, x: number, y: number): Gegner {
  const g = legeGegner(s, GEGNER_ARTEN[0], x, y)
  if (g === null) throw new Error('Gegner konnte nicht gesetzt werden')
  return g
}

describe('Risse setzen', () => {
  it('zaehlt dieselbe Waffe nur einmal', () => {
    // Der ganze Witz der Regel. Wuerde jede Waffe bei jedem Treffer reissen,
    // waere fuenfmal dieselbe Waffe der beste Bau - genau das Gegenteil des
    // Gewollten.
    const s = frischerStand()
    const g = setzeGegner(s, 0, 0)

    expect(rissSetzen(g, 0)).toBe(true)
    expect(rissSetzen(g, 0)).toBe(false)
    expect(rissSetzen(g, 0)).toBe(false)
    expect(g.risse).toBe(1)
  })

  it('zaehlt verschiedene Waffen einzeln', () => {
    const s = frischerStand()
    const g = setzeGegner(s, 0, 0)

    rissSetzen(g, 0)
    rissSetzen(g, 1)
    rissSetzen(g, 2)
    expect(g.risse).toBe(3)
  })

  it('erhoeht den genommenen Schaden je Riss', () => {
    const s = frischerStand()
    const g = setzeGegner(s, 0, 0)

    expect(rissBonus(g)).toBeCloseTo(1)
    rissSetzen(g, 0)
    expect(rissBonus(g)).toBeCloseTo(1 + RISS_BONUS)
    rissSetzen(g, 1)
    expect(rissBonus(g)).toBeCloseTo(1 + 2 * RISS_BONUS)
  })

  it('meldet Zersplitterung erst ab der Schwelle', () => {
    const s = frischerStand()
    const g = setzeGegner(s, 0, 0)

    for (let i = 0; i < RISS_SCHWELLE - 1; i++) {
      rissSetzen(g, i)
      expect(zersplitterBereit(g)).toBe(false)
    }
    rissSetzen(g, RISS_SCHWELLE - 1)
    expect(zersplitterBereit(g)).toBe(true)
  })
})

describe('Risse verfallen', () => {
  it('sind nach dem Fenster wieder weg', () => {
    // Ohne Verfall koennte man ueber eine ganze Minute hinweg drei Waffen
    // einmal streifen lassen. Die Regel soll Gleichzeitigkeit belohnen.
    const s = frischerStand()
    const g = setzeGegner(s, 0, 0)

    rissSetzen(g, 0)
    rissSetzen(g, 1)
    expect(g.risse).toBe(2)

    risseAblaufen(g, RISS_FENSTER + 0.01)
    expect(g.risse).toBe(0)
    expect(g.risseMaske).toBe(0)
  })

  it('werden von jedem neuen Treffer aufgefrischt', () => {
    const s = frischerStand()
    const g = setzeGegner(s, 0, 0)

    rissSetzen(g, 0)
    risseAblaufen(g, RISS_FENSTER * 0.9)
    rissSetzen(g, 1)
    risseAblaufen(g, RISS_FENSTER * 0.9)

    // Der erste Riss ist zusammen mit dem zweiten am Leben geblieben.
    expect(g.risse).toBe(2)
  })
})

describe('Zersplitterung', () => {
  it('reisst Nachbarn mit', () => {
    const s = frischerStand()
    const mitte = setzeGegner(s, 0, 0)
    const nachbar = setzeGegner(s, 30, 0)
    const weitWeg = setzeGegner(s, 900, 900)
    const hpNachbar = nachbar.hp
    const hpWeitWeg = weitWeg.hp

    // Die Splitterwelle sucht ihre Nachbarn ueber das Gitter - ohne
    // aufgebautes Gitter findet sie lautlos niemanden.
    gitterAufbauen(s)

    // Drei verschiedene Waffen auf den mittleren Gegner.
    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, mitte, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)

    expect(nachbar.hp).toBeLessThan(hpNachbar)
    expect(weitWeg.hp).toBe(hpWeitWeg)
  })

  it('zaehlt in der Statistik mit', () => {
    const s = frischerStand()
    const g = setzeGegner(s, 0, 0)
    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, g, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)
    expect(s.statistik.zersplittert).toBeGreaterThan(0)
  })

  it('laeuft im dichten Pulk durch, ohne sich aufzuhaengen', () => {
    // Die eigentliche Gefahr der Regel: Nachbar reisst Nachbar reisst
    // Nachbar. Ohne Tiefenbegrenzung und ohne Warteschlange endet das in
    // einem Stapelueberlauf. 400 eng gepackte Gegner sind der Ernstfall.
    const s = frischerStand()
    for (let i = 0; i < 400; i++) {
      const winkel = i * 0.61
      const r = Math.sqrt(i) * 7
      setzeGegner(s, Math.cos(winkel) * r, Math.sin(winkel) * r)
    }
    gitterAufbauen(s)
    const start = s.gegner.aktiv[0]
    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, start, 1, platz, false, 0, 0)

    expect(() => arbeiteKaskadeAb(s)).not.toThrow()
    // Sie wirkt, bleibt aber begrenzt: nicht das halbe Feld.
    expect(s.statistik.zersplittert).toBeGreaterThan(0)
    expect(s.statistik.zersplittert).toBeLessThan(400)
  })

  it('haelt die Tiefenbegrenzung bei mindestens zwei Stufen', () => {
    // Waere sie 1, gaebe es gar keine Kette und die Regel verloere ihren
    // spektakulaersten Teil.
    expect(KASKADE_MAX_TIEFE).toBeGreaterThanOrEqual(2)
  })
})

describe('Risse im laufenden Spiel', () => {
  it('verfallen ueber die Tickschleife', () => {
    const s = frischerStand()
    const g = setzeGegner(s, 200, 0)
    rissSetzen(g, 0)

    let vergangen = 0
    while (vergangen < RISS_FENSTER + 0.1) {
      risseAblaufen(g, TICK_DT)
      vergangen += TICK_DT
    }
    expect(g.risse).toBe(0)
  })
})
