import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { charakterMit } from '../src/game/charaktere'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { legeGegner } from '../src/game/spawner'
import type { Befehle, Spielstand } from '../src/game/state'
import { STOSS_ABKLING, STOSS_DAUER } from '../src/game/player'
import { erzeugeSpielstand, leereBefehle, PAUSE_EINTRAEGE, starteLauf, tick } from '../src/game/state'

/**
 * Das Pausenmenue.
 *
 * Es steht in der Spiellogik und nicht im Zeichencode - genau deshalb laesst
 * es sich hier ohne Browser pruefen. Der wichtigste Test ist der letzte:
 * Aufgeben muss den Lauf *auswerten*. Waere es ein blosser Ausstieg, waere es
 * das Schlupfloch, durch das jeder schlechte Lauf aus der Bestenliste
 * verschwindet.
 */

function laufenderStand(): Spielstand {
  const s = erzeugeSpielstand(31)
  starteLauf(s, 31, charakterMit('splitter'))
  return s
}

function druecke(s: Spielstand, aenderung: Partial<Befehle>): void {
  const b = leereBefehle()
  Object.assign(b, aenderung)
  tick(s, b, TICK_DT)
}

describe('Pause', () => {
  it('haelt an und gibt mit derselben Taste wieder frei', () => {
    const s = laufenderStand()
    expect(s.phase).toBe('laufend')

    druecke(s, { pause: true })
    expect(s.phase).toBe('pause')

    druecke(s, { pause: true })
    expect(s.phase).toBe('laufend')
  })

  it('laesst waehrenddessen nichts weiterlaufen', () => {
    const s = laufenderStand()
    druecke(s, { pause: true })

    const zeit = s.zeit
    const gegner = s.gegner.anzahl
    for (let i = 0; i < 60; i++) druecke(s, {})
    expect(s.zeit).toBe(zeit)
    expect(s.gegner.anzahl).toBe(gegner)
  })

  it('blaettert senkrecht und laeuft um', () => {
    const s = laufenderStand()
    druecke(s, { pause: true })
    expect(s.pauseWahl).toBe(0)

    druecke(s, { runter: true })
    expect(s.pauseWahl).toBe(1)

    druecke(s, { hoch: true })
    druecke(s, { hoch: true })
    expect(s.pauseWahl).toBe(PAUSE_EINTRAEGE.length - 1)
  })

  it('schaltet den Ton um, ohne den Lauf zu verlassen', () => {
    const s = laufenderStand()
    druecke(s, { pause: true })
    s.pauseWahl = PAUSE_EINTRAEGE.indexOf('ton')

    druecke(s, { bestaetigen: true })
    expect(s.tonAus).toBe(true)
    expect(s.phase).toBe('pause')

    druecke(s, { bestaetigen: true })
    expect(s.tonAus).toBe(false)
  })

  it('wertet den Lauf beim Aufgeben ganz normal aus', () => {
    const s = laufenderStand()
    // Etwas Lauf, damit es auch etwas auszuwerten gibt.
    const b = leereBefehle()
    b.wahl = 0
    for (let i = 0; i < 900; i++) tick(s, b, TICK_DT)

    druecke(s, { pause: true })
    s.pauseWahl = PAUSE_EINTRAEGE.indexOf('aufgeben')
    druecke(s, { bestaetigen: true })

    expect(s.phase).toBe('tot')
    expect(s.punkte).toBeGreaterThan(0)
    expect(s.bestwert).toBe(s.punkte)
  })

  it('wertet auch den Weg zurueck zur Charakterwahl aus', () => {
    // Sonst waere die Charakterwahl das Schlupfloch, durch das ein schlechter
    // Lauf spurlos verschwindet.
    const s = laufenderStand()
    const b = leereBefehle()
    b.wahl = 0
    for (let i = 0; i < 900; i++) tick(s, b, TICK_DT)

    druecke(s, { pause: true })
    s.pauseWahl = PAUSE_EINTRAEGE.indexOf('auswahl')
    druecke(s, { bestaetigen: true })

    expect(s.phase).toBe('titel')
    expect(s.bestwert).toBeGreaterThan(0)
  })
})

describe('Der Stoß', () => {
  it('setzt die Figur ein Stück weiter und macht dabei unverwundbar', () => {
    const s = laufenderStand()
    s.gegner.alleFreigeben()
    const sp = s.spieler
    sp.blickX = 1
    sp.blickY = 0
    const vorher = sp.x

    druecke(s, { bestaetigen: true, x: 1 })
    expect(sp.stossRest).toBeGreaterThan(0)
    expect(sp.unverwundbar).toBeGreaterThan(0)

    // Deutlich weiter als ein normaler Schritt in derselben Zeit.
    const strecke = sp.x - vorher
    expect(strecke).toBeGreaterThan(sp.tempo * TICK_DT * 2)
  })

  it('laesst sich nicht sofort wiederholen', () => {
    const s = laufenderStand()
    s.gegner.alleFreigeben()
    const sp = s.spieler

    druecke(s, { bestaetigen: true, x: 1 })
    expect(sp.stossAbkling).toBeGreaterThan(0)

    // Warten, bis der Stoss vorbei ist, aber die Abklingzeit noch laeuft.
    for (let i = 0; i < 20; i++) druecke(s, { x: 1 })
    expect(sp.stossRest).toBe(0)
    expect(sp.stossAbkling).toBeGreaterThan(0)

    const vorher = sp.x
    druecke(s, { bestaetigen: true, x: 1 })
    expect(sp.stossRest).toBe(0)
    // Nur ein normaler Schritt, kein Satz.
    expect(sp.x - vorher).toBeLessThan(sp.tempo * TICK_DT * 1.5)
  })

  it('ist nach der Abklingzeit wieder bereit', () => {
    const s = laufenderStand()
    s.gegner.alleFreigeben()
    const sp = s.spieler
    druecke(s, { bestaetigen: true, x: 1 })

    const ticks = Math.ceil((STOSS_ABKLING + STOSS_DAUER) / TICK_DT) + 4
    for (let i = 0; i < ticks; i++) druecke(s, { x: 1 })
    expect(sp.stossAbkling).toBe(0)

    druecke(s, { bestaetigen: true, x: 1 })
    expect(sp.stossRest).toBeGreaterThan(0)
  })

  it('stoesst aus dem Stand in die zuletzt gelaufene Richtung', () => {
    // Gerade im Gedraenge steht man einen Moment still - ein verschluckter
    // Knopfdruck fuehlt sich dann wie ein Fehler des Spiels an.
    const s = laufenderStand()
    s.gegner.alleFreigeben()
    const sp = s.spieler

    druecke(s, { y: -1 })
    expect(sp.blickY).toBe(-1)

    const vorher = sp.y
    druecke(s, { bestaetigen: true })
    expect(sp.stossRest).toBeGreaterThan(0)
    expect(sp.y).toBeLessThan(vorher)
  })

  it('setzt keinen Riss', () => {
    // Bewusst so: Der Stoss bleibt reines Ausweichen und haengt sich nicht an
    // die Kernregel - sonst braeuchte die Riss-Bitmaske einen weiteren Platz.
    const s = laufenderStand()
    s.gegner.alleFreigeben()
    const g = legeGegner(s, GEGNER_ARTEN[0], s.spieler.x + 8, s.spieler.y)
    if (g === null) throw new Error('kein Gegner')
    s.spieler.waffen = []

    druecke(s, { bestaetigen: true, x: 1 })
    expect(g.risse).toBe(0)
  })
})
