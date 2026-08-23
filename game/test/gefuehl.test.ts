import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { bewegeSpieler, erzeugeSpieler, stosse } from '../src/game/player'
import { legeGegner } from '../src/game/spawner'
import type { Spielstand } from '../src/game/state'
import {
  erzeugeSpielstand,
  gitterAufbauen,
  halteAn,
  kickeKamera,
  leereBefehle,
  starteLauf,
  tick,
} from '../src/game/state'

/**
 * Wie es sich anfuehlt.
 *
 * Hakans zweite Haelfte der Rueckmeldung war "das Spielkonzept, wie es sich
 * spielen laesst". Wucht laesst sich nicht als Bild pruefen, aber sehr wohl
 * als Regel: Der Hitstop muss die *Simulation* anhalten und die Optik laufen
 * lassen, er darf sich nicht aufaddieren, und die Traegheit darf kein
 * Ausweichen kosten.
 */

function lauf(saat = 12): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  s.spieler.waffen = []
  s.spieler.xpMult = 0
  s.spieler.maxHp = 1e9
  s.spieler.hp = 1e9
  gitterAufbauen(s)
  return s
}

describe('Hitstop', () => {
  it('friert die Spielzeit ein, aber nicht die Partikel', () => {
    const s = lauf()
    // Ein paar Partikel anlegen, damit es etwas zu beobachten gibt.
    const g = legeGegner(s, GEGNER_ARTEN[0], 300, 0)
    if (g === null) throw new Error('kein Platz')
    g.tot = true
    tick(s, leereBefehle(), TICK_DT)
    const partikel = s.partikel.aktiv[0]
    expect(partikel).toBeDefined()

    halteAn(s, 0.1)
    const zeitVorher = s.zeit
    const lebenVorher = partikel.leben
    for (let i = 0; i < 4; i++) tick(s, leereBefehle(), TICK_DT)

    // Die Welt steht ...
    expect(s.zeit).toBe(zeitVorher)
    // ... die Optik nicht. Genau diese Trennung macht aus dem Anhalten Wucht
    // statt eines Rucklers.
    expect(partikel.leben).toBeLessThan(lebenVorher)
  })

  it('laeuft danach ganz normal weiter', () => {
    const s = lauf()
    halteAn(s, 0.03)
    for (let i = 0; i < 6; i++) tick(s, leereBefehle(), TICK_DT)
    const zeitVorher = s.zeit
    tick(s, leereBefehle(), TICK_DT)
    expect(s.zeit).toBeGreaterThan(zeitVorher)
  })

  it('addiert sich nicht auf - eine Kaskade friert das Spiel nicht ein', () => {
    /*
     * Der wichtigste Test der Datei.
     *
     * Eine Kettenreaktion loest in *einem* Tick dutzende Zersplitterungen aus.
     * Wuerde jede ihre 55 Millisekunden dazulegen, staende das Spiel
     * sekundenlang - und aus dem staerksten Moment des Spiels wuerde ein
     * Aussetzer.
     */
    const s = lauf()
    for (let i = 0; i < 60; i++) halteAn(s, 0.055)
    expect(s.stopRest).toBeLessThanOrEqual(0.16)
  })

  it('nimmt den laengsten Anlass, nicht den letzten', () => {
    const s = lauf()
    halteAn(s, 0.12)
    halteAn(s, 0.02)
    expect(s.stopRest).toBeCloseTo(0.12, 3)
  })
})

describe('Traegheit', () => {
  it('kommt schnell genug auf Tempo, um Ausweichen nicht zu kosten', () => {
    /*
     * Die Zahl, an der alles haengt.
     *
     * Der Stuermer kuendigt seine Bahn 0,7 Sekunden vorher an, der Boss 0,8
     * bis 1,2. Ein Anlauf, der laenger braucht als ein Zehntel davon, wuerde
     * ein Ausweichmanoever kosten - und dann waere die Traegheit kein Gewicht
     * mehr, sondern eine Behinderung.
     */
    const sp = erzeugeSpieler()
    const voll = sp.tempo * sp.tempoMult
    let ticks = 0
    while (Math.abs(sp.laufX) < voll * 0.8 && ticks < 60) {
      bewegeSpieler(sp, 1, 0, TICK_DT)
      ticks++
    }
    expect(ticks).toBeLessThan(7)
    expect(ticks * TICK_DT).toBeLessThan(0.1)
  })

  it('faehrt an, statt im ersten Bild voll zu laufen', () => {
    const sp = erzeugeSpieler()
    bewegeSpieler(sp, 1, 0, TICK_DT)
    // Ohne Anlauf waere das exakt `tempo * dt` - genau das soll es nicht sein.
    expect(sp.x).toBeGreaterThan(0)
    expect(sp.x).toBeLessThan(sp.tempo * TICK_DT * 0.5)
  })

  it('rollt beim Loslassen aus, statt zu stehen', () => {
    const sp = erzeugeSpieler()
    for (let i = 0; i < 30; i++) bewegeSpieler(sp, 1, 0, TICK_DT)
    const beiVollgas = sp.x
    for (let i = 0; i < 3; i++) bewegeSpieler(sp, 0, 0, TICK_DT)
    expect(sp.x).toBeGreaterThan(beiVollgas)
    expect(sp.laufX).toBeGreaterThan(0)
  })

  it('wird vom Stoss vollstaendig ueberschrieben', () => {
    const sp = erzeugeSpieler()
    // Erst nach links laufen, dann nach rechts stossen: Der Stoss darf sich
    // nicht mit dem Anlauf verrechnen, sonst ist er kein Ausweichen mehr.
    for (let i = 0; i < 20; i++) bewegeSpieler(sp, -1, 0, TICK_DT)
    expect(sp.laufX).toBeLessThan(0)

    expect(stosse(sp, 1, 0, 1, 0)).toBe(true)
    const vorher = sp.x
    bewegeSpieler(sp, -1, 0, TICK_DT)
    expect(sp.x).toBeGreaterThan(vorher)
    expect(sp.laufX).toBeGreaterThan(0)
  })
})

describe('Kamera mit Charakter', () => {
  it('schaut in Laufrichtung voraus', () => {
    const s = lauf()
    const b = leereBefehle()
    b.x = 1
    for (let i = 0; i < 90; i++) tick(s, b, TICK_DT)
    // Sie steht vor dem Spieler, nicht auf ihm - man sieht, wohin man laeuft.
    expect(s.kamera.x).toBeGreaterThan(s.spieler.x)
  })

  it('weicht von einem Einschlag zurueck und kommt wieder', () => {
    const s = lauf()
    kickeKamera(s, s.kamera.x + 200, s.kamera.y, 40)
    expect(s.kamera.kickX).toBeLessThan(0)

    for (let i = 0; i < 90; i++) tick(s, leereBefehle(), TICK_DT)
    expect(Math.abs(s.kamera.kickX)).toBeLessThan(1)
  })

  it('laesst den Zoomstoss von selbst abklingen', () => {
    const s = lauf()
    s.zoomStoss = 0.1
    for (let i = 0; i < 90; i++) tick(s, leereBefehle(), TICK_DT)
    expect(s.zoomStoss).toBeLessThan(0.01)
  })
})
