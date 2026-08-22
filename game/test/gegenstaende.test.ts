import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { erzeugeSpieler } from '../src/game/player'
import { RISS_FENSTER } from '../src/game/risse'
import { legeGegner } from '../src/game/spawner'
import type { Befehle, Gegner, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, leereBefehle, starteLauf, tick } from '../src/game/state'
import { PASSIVE } from '../src/game/upgrades'
import { arbeiteKaskadeAb, MAX_ZONEN, verletzeGegner } from '../src/game/welt'

/**
 * Gegenstände, die Regeln ändern.
 *
 * Vorher standen dort sieben Prozentwerte - genau der Vorwurf, den Hakan den
 * Waffen gemacht hat, nur eine Ebene tiefer. Diese Tests halten fest, dass
 * jeder der zwoelf neuen wirklich etwas *anderes* tut, statt eine Zahl zu
 * erhoehen.
 */

function nimm(id: string) {
  const p = PASSIVE.find((x) => x.id === id)
  if (p === undefined) throw new Error(`Gegenstand ${id} fehlt`)
  return p
}

function leeresFeld(saat = 6): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  s.schreine.alleFreigeben()
  gitterAufbauen(s)

  /*
   * Die Warteschlange der Zersplitterungen liegt als Modulzustand in
   * `welt.ts` - im Spiel wird sie jeden Tick geleert, in Tests nicht. Ein
   * vorheriger Test, der eine Zersplitterung vormerkt, ohne sie abzuarbeiten,
   * schiebt sie sonst in den naechsten hinein. Genau daran ist der
   * Blutglas-Test zuerst gescheitert: Er heilte zweimal.
   */
  arbeiteKaskadeAb(s)
  return s
}

function setze(s: Spielstand, x: number, y: number, hp = 1e6): Gegner {
  const g = legeGegner(s, GEGNER_ARTEN[0], x, y)
  if (g === null) throw new Error('kein Gegner')
  g.hp = hp
  g.maxHp = hp
  return g
}

function laufe(s: Spielstand, ticks: number, aenderung: Partial<Befehle> = {}): void {
  const b = leereBefehle()
  Object.assign(b, aenderung)
  for (let i = 0; i < ticks; i++) tick(s, b, TICK_DT)
}

describe('Nachhall', () => {
  it('haelt Risse laenger offen', () => {
    const s = leeresFeld()
    nimm('nachhall').anwenden(s.spieler)
    const g = setze(s, 0, 0)
    verletzeGegner(s, g, 1, 0, false, 0, 0)
    expect(g.risseZeit).toBeCloseTo(RISS_FENSTER + 1, 5)
  })
})

describe('Kettenriss', () => {
  it('springt nach dem dritten Riss auf einen Nachbarn', () => {
    const s = leeresFeld()
    nimm('kettenriss').anwenden(s.spieler)
    const a = setze(s, 0, 0)
    const b = setze(s, 60, 0)
    gitterAufbauen(s)

    // Drei frische Risse auf a - der dritte springt weiter.
    verletzeGegner(s, a, 1, 0, false, 0, 0)
    verletzeGegner(s, a, 1, 1, false, 0, 0)
    expect(b.risse).toBe(0)
    verletzeGegner(s, a, 1, 2, false, 0, 0)
    expect(b.risse).toBe(1)
  })

  it('zaehlt nur neue Risse, nicht jeden Treffer', () => {
    const s = leeresFeld()
    nimm('kettenriss').anwenden(s.spieler)
    const a = setze(s, 0, 0)
    const b = setze(s, 60, 0)
    gitterAufbauen(s)

    // Zehnmal dieselbe Waffe: ein Riss, also nie ein Sprung.
    for (let i = 0; i < 10; i++) verletzeGegner(s, a, 1, 0, false, 0, 0)
    expect(b.risse).toBe(0)
  })
})

describe('Blutglas und Splitterfeld', () => {
  it('heilt bei jeder Zersplitterung', () => {
    const s = leeresFeld()
    nimm('blutglas').anwenden(s.spieler)
    s.spieler.hp = 50
    const g = setze(s, 0, 0)
    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, g, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)
    expect(s.spieler.hp).toBe(51)
  })

  it('laesst Scherben liegen', () => {
    const s = leeresFeld()
    nimm('splitterfeld').anwenden(s.spieler)
    const g = setze(s, 0, 0)
    expect(s.zonen.anzahl).toBe(0)
    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, g, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)
    expect(s.zonen.anzahl).toBe(1)
  })
})

describe('Fehlschlag', () => {
  it('setzt bei einem kritischen Treffer einen zusaetzlichen Riss', () => {
    const s = leeresFeld()
    const g = setze(s, 0, 0)
    verletzeGegner(s, g, 1, 0, true, 0, 0)
    expect(g.risse).toBe(1)

    const t = leeresFeld()
    nimm('fehlschlag').anwenden(t.spieler)
    const h = setze(t, 0, 0)
    verletzeGegner(t, h, 1, 0, true, 0, 0)
    expect(h.risse).toBe(2)
  })
})

describe('Zwillingsbruch', () => {
  it('tauscht Wucht gegen Weite', () => {
    const ohne = leeresFeld()
    const a = setze(ohne, 0, 0)
    for (let platz = 0; platz < 3; platz++) verletzeGegner(ohne, a, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(ohne)
    const wuchtOhne = a.maxHp - a.hp

    const mit = leeresFeld()
    nimm('zwillingsbruch').anwenden(mit.spieler)
    const b = setze(mit, 0, 0)
    for (let platz = 0; platz < 3; platz++) verletzeGegner(mit, b, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(mit)
    const wuchtMit = b.maxHp - b.hp

    expect(wuchtMit).toBeLessThan(wuchtOhne)
    expect(mit.spieler.zwillingsbruch).toBe(2)
  })
})

describe('Standhaft', () => {
  it('laedt beim Stillstehen einen Schild, der genau einen Treffer schluckt', () => {
    const s = leeresFeld()
    nimm('standhaft').anwenden(s.spieler)
    s.spieler.waffen = []

    laufe(s, 150)
    expect(s.spieler.schild).toBe(true)

    const leben = s.spieler.hp
    const g = setze(s, s.spieler.x + 6, s.spieler.y, 1e6)
    g.schaden = 20
    laufe(s, 2)
    expect(s.spieler.hp).toBe(leben)
    expect(s.spieler.schild).toBe(false)
  })

  it('verliert den Fortschritt beim Weiterlaufen', () => {
    const s = leeresFeld()
    nimm('standhaft').anwenden(s.spieler)
    laufe(s, 60)
    expect(s.spieler.stehZeit).toBeGreaterThan(0)
    laufe(s, 2, { x: 1 })
    expect(s.spieler.stehZeit).toBe(0)
  })
})

describe('Sog', () => {
  it('zieht nur im Stillstand weiter', () => {
    const sp = erzeugeSpieler()
    nimm('sog').anwenden(sp)
    expect(sp.sog).toBeGreaterThan(0)
    // Der Radius selbst bleibt unangetastet - die Wirkung haengt am Stehen.
    expect(sp.magnetRadius).toBe(erzeugeSpieler().magnetRadius)
  })
})

describe('Keiner ist nur eine Zahl', () => {
  it('laesst die zwoelf Regeln den Grundschaden unberuehrt', () => {
    // Wenn ein "Regel"-Gegenstand am Ende doch nur schadenMult erhoeht, ist er
    // wieder das, was ersetzt werden sollte.
    const werte = new Set(['panzerplatte', 'laufsohlen', 'notpflaster'])
    for (const p of PASSIVE) {
      if (werte.has(p.id)) continue
      const sp = erzeugeSpieler()
      p.anwenden(sp)
      expect(sp.schadenMult, p.id).toBe(1)
      expect(sp.kritChance, p.id).toBeCloseTo(erzeugeSpieler().kritChance, 6)
    }
  })
})

describe('Der Deckel auf Zonen', () => {
  it('laesst das Splitterfeld die Karte nicht zutapezieren', () => {
    /*
     * Gefunden von der Messung, nicht vom Auge.
     *
     * Mit drei Stapeln bleibt jede Zersplitterung neun Sekunden lang als Zone
     * liegen, und jede Zone fragt pro Tick ihren Umkreis im Gitter ab. Gemessen
     * standen **460 Stueck gleichzeitig** - der teuerste Posten der ganzen
     * Simulation, ausgeloest von einem Gegenstand, den man dreimal zieht, ohne
     * etwas zu ahnen. Im Bild sah man nur, dass viel los ist.
     */
    const s = leeresFeld()
    s.spieler.splitterFeld = 9

    for (let runde = 0; runde < 40; runde++) {
      for (let i = 0; i < 12; i++) {
        const g = setze(s, i * 40 - 200, runde * 30 - 500, 10)
        g.zersplittert = true
        g.maxHp = 10
        // Direkt in die Warteschlange: Der Weg ueber drei Waffen ist hier
        // nicht der Punkt, die Zahl der entstehenden Zonen schon.
        verletzeGegner(s, g, 1, 0, false, 0, 0)
        g.zersplittert = false
        g.risse = 3
        g.risseMaske = 0b111
        verletzeGegner(s, g, 1, 1, false, 0, 0)
      }
      arbeiteKaskadeAb(s)
      expect(s.zonen.anzahl).toBeLessThanOrEqual(MAX_ZONEN)
    }
    // Und der Deckel wird auch wirklich erreicht - sonst prueft der Test nur,
    // dass nichts passiert ist.
    expect(s.zonen.anzahl).toBe(MAX_ZONEN)
  })
})
