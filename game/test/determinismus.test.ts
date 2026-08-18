import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { Rng } from '../src/core/rng'
import { MAX_GEGNER } from '../src/game/spawner'
import type { Befehle, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, starteLauf, tick } from '../src/game/state'

/**
 * Der Lauf muss bei gleichem Saatwert gleich verlaufen.
 *
 * Das ist keine Spielerei: Ohne diese Zusage laesst sich ein Fehler, der alle
 * 200 Laeufe auftritt, nicht nachstellen - und ein "Taeglicher Lauf", in
 * diesem Genre das wichtigste Wiederkehr-Feature, waere nicht mehr
 * nachzuruesten.
 */

/** Eine feste, aber nicht triviale Bewegung - Kreise mit ungleichen Achsen. */
function befehleFuer(i: number, aus: Befehle): Befehle {
  const w = i * 0.013
  const x = Math.cos(w)
  const y = Math.sin(w * 0.7)
  const laenge = Math.hypot(x, y) || 1
  aus.x = x / laenge
  aus.y = y / laenge
  aus.bestaetigen = false
  aus.links = false
  aus.rechts = false
  // Beim Levelup immer die erste Karte - im Lauf wird das Feld ignoriert.
  aus.wahl = 0
  return aus
}

function laufe(saat: number, ticks: number, unsterblich = false): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  if (unsterblich) {
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
  }
  const b: Befehle = { x: 0, y: 0, bestaetigen: false, links: false, rechts: false, wahl: 0 }
  for (let i = 0; i < ticks; i++) tick(s, befehleFuer(i, b), TICK_DT)
  return s
}

/** Nur Spielrelevantes - ausdruecklich ohne Partikel und andere Optik. */
function abdruck(s: Spielstand): string {
  const sp = s.spieler
  return JSON.stringify({
    phase: s.phase,
    zeit: s.zeit.toFixed(6),
    x: sp.x.toFixed(6),
    y: sp.y.toFixed(6),
    hp: sp.hp.toFixed(6),
    level: sp.level,
    xp: sp.xp.toFixed(6),
    kills: s.statistik.kills,
    schaden: s.statistik.schaden,
    gegner: s.gegner.anzahl,
    kristalle: s.kristalle.anzahl,
    rng: s.rng.snapshot(),
  })
}

describe('Determinismus', () => {
  it('gleicher Saatwert ergibt nach 3000 Ticks denselben Zustand', () => {
    expect(abdruck(laufe(4242, 3000))).toBe(abdruck(laufe(4242, 3000)))
  })

  it('anderer Saatwert ergibt einen anderen Zustand', () => {
    expect(abdruck(laufe(4242, 3000))).not.toBe(abdruck(laufe(4243, 3000)))
  })

  it('der Optik-Zufall veraendert den Lauf nicht', () => {
    // Der eigentliche Zweck der zwei getrennten Stroeme. Faellt dieser Test,
    // zieht irgendwo im Spielcode jemand aus `rngOptik` - dann veraendert
    // eine neue Partikelwolke die gesamte Gegnerabfolge, und der Saatwert
    // ist nichts mehr wert.
    const a = erzeugeSpielstand(999)
    starteLauf(a, 999)
    const b = erzeugeSpielstand(999)
    starteLauf(b, 999)
    b.rngOptik = new Rng(123456)

    const bef: Befehle = { x: 0, y: 0, bestaetigen: false, links: false, rechts: false, wahl: 0 }
    for (let i = 0; i < 2500; i++) {
      tick(a, befehleFuer(i, bef), TICK_DT)
      tick(b, befehleFuer(i, bef), TICK_DT)
    }
    expect(abdruck(a)).toBe(abdruck(b))
  })
})

describe('Der Lauf tut ueberhaupt etwas', () => {
  it('spawnt Gegner, toetet sie und vergibt Stufen', () => {
    const s = laufe(2026, 3600, true)
    expect(s.gegner.anzahl).toBeGreaterThan(0)
    expect(s.statistik.kills).toBeGreaterThan(0)
    expect(s.statistik.schaden).toBeGreaterThan(0)
    expect(s.spieler.level).toBeGreaterThan(1)
  })

  it('haelt die Aufstiegskurve in einem brauchbaren Bereich', () => {
    // Eine Minute Spiel soll spuerbar mehrere Entscheidungen bringen, aber
    // nicht im Sekundentakt ins Menue springen. Bricht dieser Test, ist am
    // Balancing etwas verrutscht - genau dann will man das wissen.
    const s = laufe(2026, 60 * 60, true)
    expect(s.spieler.level).toBeGreaterThanOrEqual(4)
    expect(s.spieler.level).toBeLessThanOrEqual(14)
  })

  it('haelt die Gegnerzahl unter der Obergrenze', () => {
    const s = laufe(31337, 60 * 180, true)
    expect(s.gegner.anzahl).toBeLessThanOrEqual(MAX_GEGNER)
  })

  it('laesst den Spieler ohne Schutz irgendwann sterben', () => {
    // Wenn Nichtstun ueberlebbar waere, gaebe es kein Spiel. Der Lauf steht
    // still, die Gegner kommen trotzdem.
    const s = erzeugeSpielstand(5)
    starteLauf(s, 5)
    const b: Befehle = { x: 0, y: 0, bestaetigen: false, links: false, rechts: false, wahl: 0 }
    for (let i = 0; i < 60 * 120 && s.phase !== 'tot'; i++) tick(s, b, TICK_DT)
    expect(s.phase).toBe('tot')
  })
})
