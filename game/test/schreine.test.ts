import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { findeBoss } from '../src/game/bosse'
import { AMBOSS_DAUER, AMBOSS_ZERFALL, SCHREIN_RADIUS, SCHREINE } from '../src/game/schreine'
import type { SchreinArt } from '../src/game/schreine'
import type { Befehle, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, leereBefehle, starteLauf, tick } from '../src/game/state'

/**
 * Schreine.
 *
 * Sie sind der einzige Grund, irgendwohin zu *wollen* statt nur wegzulaufen.
 * Der Amboss traegt das: Er verlangt Stillstand - also genau das, was einen in
 * diesem Spiel umbringt.
 */

function laufMitSchrein(art: SchreinArt): Spielstand {
  const s = erzeugeSpielstand(17)
  starteLauf(s, 17)
  s.gegner.alleFreigeben()
  s.schreine.alleFreigeben()

  const sch = s.schreine.nimm()
  sch.art = art
  sch.x = s.spieler.x
  sch.y = s.spieler.y
  sch.ladung = 0
  sch.benutzt = false
  return s
}

function laufe(s: Spielstand, ticks: number, aenderung: Partial<Befehle> = {}): void {
  const b = leereBefehle()
  Object.assign(b, aenderung)
  for (let i = 0; i < ticks; i++) tick(s, b, TICK_DT)
}

describe('Jeder Schrein ist ein Handel', () => {
  it('nennt Preis und Lohn', () => {
    for (const d of SCHREINE) {
      expect(d.preis.length, d.art).toBeGreaterThan(0)
      expect(d.lohn.length, d.art).toBeGreaterThan(0)
    }
  })
})

describe('Der Amboss', () => {
  it('laedt nur, solange man wirklich stillsteht', () => {
    const s = laufMitSchrein('amboss')
    const sch = s.schreine.aktiv[0]

    laufe(s, 30)
    expect(sch.ladung).toBeGreaterThan(0)
    expect(sch.benutzt).toBe(false)
  })

  it('faellt beim Weitergehen schneller zurueck, als er sich fuellt', () => {
    // Sonst sammelt man ihn in drei kurzen Anlaeufen ein, und aus der Mutprobe
    // wird Buchhaltung.
    expect(AMBOSS_ZERFALL).toBeGreaterThan(1 / AMBOSS_DAUER)

    const s = laufMitSchrein('amboss')
    const sch = s.schreine.aktiv[0]
    laufe(s, 60)
    const geladen = sch.ladung
    expect(geladen).toBeGreaterThan(0)

    laufe(s, 20, { x: 1 })
    expect(sch.ladung).toBeLessThan(geladen)
  })

  it('loest nach drei Sekunden Stillstand aus und gibt eine Karte', () => {
    const s = laufMitSchrein('amboss')
    const sch = s.schreine.aktiv[0]

    laufe(s, Math.ceil(AMBOSS_DAUER / TICK_DT) + 6)
    expect(sch.benutzt).toBe(true)
    expect(s.phase).toBe('levelup')
  })

  it('laedt nicht, wenn man ausserhalb steht', () => {
    const s = laufMitSchrein('amboss')
    const sch = s.schreine.aktiv[0]
    sch.x = s.spieler.x + SCHREIN_RADIUS * 3

    laufe(s, 120)
    expect(sch.ladung).toBe(0)
    expect(sch.benutzt).toBe(false)
  })

  it('laedt waehrend eines Stosses nicht weiter', () => {
    // Ein Stoss ist Bewegung, auch wenn der Stick in der Mitte steht.
    const s = laufMitSchrein('amboss')
    const sch = s.schreine.aktiv[0]
    laufe(s, 30)
    const geladen = sch.ladung

    laufe(s, 1, { bestaetigen: true })
    laufe(s, 4)
    expect(sch.ladung).toBeLessThan(geladen)
  })
})

describe('Die Gierscherbe', () => {
  it('macht die Etappe schwerer und gibt sofort eine Stufe', () => {
    const s = laufMitSchrein('gierscherbe')
    const stufe = s.spieler.level

    laufe(s, 2)
    expect(s.schreine.aktiv[0].benutzt).toBe(true)
    expect(s.etappenWerte.zaehigkeit).toBeGreaterThan(1)
    expect(s.etappenWerte.nachschub).toBeGreaterThan(1)
    // Der Aufstieg kommt ueber die normale Erfahrungsschiene.
    expect(s.spieler.level + (s.levelWartet > 0 ? 1 : 0)).toBeGreaterThan(stufe)
  })
})

describe('Das Bruchmal', () => {
  it('ruft sofort einen Boss und gibt eine bessere Karte', () => {
    const s = laufMitSchrein('bruchmal')
    expect(findeBoss(s)).toBeNull()

    laufe(s, 2)
    expect(s.schreine.aktiv[0].benutzt).toBe(true)
    expect(findeBoss(s)).not.toBeNull()
    expect(s.phase).toBe('levelup')
  })
})

describe('Verteilung', () => {
  it('legt zu jedem Laufbeginn welche aus', () => {
    const s = erzeugeSpielstand(33)
    starteLauf(s, 33)
    expect(s.schreine.anzahl).toBeGreaterThanOrEqual(2)
    expect(s.schreine.anzahl).toBeLessThanOrEqual(3)
  })

  it('ist bei gleichem Saatwert gleich', () => {
    // Sie kommen aus `s.rng`, nicht aus `rngOptik` - wo ein Schrein steht,
    // veraendert den Lauf.
    const a = erzeugeSpielstand(77)
    starteLauf(a, 77)
    const b = erzeugeSpielstand(77)
    starteLauf(b, 77)

    expect(a.schreine.anzahl).toBe(b.schreine.anzahl)
    for (let i = 0; i < a.schreine.anzahl; i++) {
      expect(a.schreine.aktiv[i].art).toBe(b.schreine.aktiv[i].art)
      expect(a.schreine.aktiv[i].x).toBeCloseTo(b.schreine.aktiv[i].x, 6)
    }
  })

  it('loest denselben Schrein nur einmal aus', () => {
    const s = laufMitSchrein('gierscherbe')
    laufe(s, 2)
    const zaeh = s.etappenWerte.zaehigkeit
    // Menue wegklicken und weiterstehen.
    laufe(s, 60, { bestaetigen: true })
    expect(s.etappenWerte.zaehigkeit).toBeCloseTo(zaeh, 6)
  })
})
