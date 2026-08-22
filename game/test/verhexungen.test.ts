import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { RISS_FENSTER, RISS_MINDEST, rissSetzen } from '../src/game/risse'
import { legeGegner } from '../src/game/spawner'
import type { Spielstand } from '../src/game/state'
import { beendeLauf, erzeugeSpielstand, leereBefehle, starteLauf, tick } from '../src/game/state'
import type { VerhexungId } from '../src/game/verhexungen'
import { VERHEXUNGEN, verhexungsFaktor, ZOLL_PRO_ETAPPE } from '../src/game/verhexungen'
import { MAX_WAFFEN } from '../src/game/weapons'
import { zeichenAnteil } from '../src/game/zeichen'

/**
 * Verhexungen.
 *
 * Der Regler, mit dem sich der Spieler den Lauf selbst schwerer macht. Die
 * Regel, die diese Datei bewacht: **keine darf ihn leichter machen.** Sobald
 * eine von ihnen einen versteckten Vorteil hat, ist der Punktefaktor kein
 * Ausgleich mehr, sondern ein Geschenk - und die Bestenliste misst wieder das
 * Falsche.
 */

function lauf(saat: number, ...ids: VerhexungId[]): Spielstand {
  const s = erzeugeSpielstand(saat)
  s.verhexungen = [...ids]
  starteLauf(s, saat)
  return s
}

describe('Der Handel steht', () => {
  it('gibt jeder Verhexung einen Namen, eine Wirkung und einen Bonus', () => {
    for (const v of VERHEXUNGEN) {
      expect(v.name.length, v.id).toBeGreaterThan(0)
      expect(v.wirkung.length, v.id).toBeGreaterThan(0)
      expect(v.bonus, v.id).toBeGreaterThan(0)
    }
  })

  it('rechnet den Faktor additiv - ohne eine ist er genau 1', () => {
    expect(verhexungsFaktor([])).toBe(1)
    const alle = VERHEXUNGEN.map((v) => v.id)
    const summe = VERHEXUNGEN.reduce((a, v) => a + v.bonus, 1)
    expect(verhexungsFaktor(alle)).toBeCloseTo(summe, 6)
    expect(verhexungsFaktor(alle)).toBeGreaterThan(2)
  })

  it('legt den Faktor auf die Punkte', () => {
    const ohne = lauf(2)
    beendeLauf(ohne)
    const mit = lauf(2, 'hast', 'enge')
    beendeLauf(mit)
    expect(mit.punkte).toBeGreaterThan(ohne.punkte)
    expect(mit.punkte).toBe(Math.round(ohne.punkte * verhexungsFaktor(['hast', 'enge'])))
  })

  it('macht keine den Lauf leichter', () => {
    /*
     * Der Test, um den es hier geht.
     *
     * Geprueft wird gegen einen unberuehrten Lauf: Gegner duerfen nicht
     * langsamer sein, Waffenplaetze nicht mehr, das Rissfenster nicht laenger,
     * der Zeichenanteil nicht kleiner, das Leben nicht hoeher.
     */
    const roh = lauf(8)
    for (const v of VERHEXUNGEN) {
      const s = lauf(8, v.id)
      expect(s.tempoFeind, v.id).toBeGreaterThanOrEqual(roh.tempoFeind)
      expect(s.spieler.maxWaffen, v.id).toBeLessThanOrEqual(roh.spieler.maxWaffen)
      expect(s.spieler.rissDauer, v.id).toBeLessThanOrEqual(roh.spieler.rissDauer)
      expect(s.zeichenMult, v.id).toBeGreaterThanOrEqual(roh.zeichenMult)
      expect(s.spieler.maxHp, v.id).toBeLessThanOrEqual(roh.spieler.maxHp)
      expect(s.zoll, v.id).toBeGreaterThanOrEqual(roh.zoll)
      // Und mindestens eines davon hat sich wirklich bewegt.
      const wirkt =
        s.tempoFeind !== roh.tempoFeind ||
        s.spieler.maxWaffen !== roh.spieler.maxWaffen ||
        s.spieler.rissDauer !== roh.spieler.rissDauer ||
        s.zeichenMult !== roh.zeichenMult ||
        s.zoll !== roh.zoll ||
        s.blind !== roh.blind
      expect(wirkt, `${v.id} kostet nichts Messbares`).toBe(true)
    }
  })
})

describe('Was die einzelnen tun', () => {
  it('Hast: Gegner laufen schneller', () => {
    const roh = lauf(3)
    const hast = lauf(3, 'hast')
    const tempo = (s: Spielstand): number => {
      s.gegner.alleFreigeben()
      const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
      if (g === null) throw new Error('kein Platz')
      return g.tempo
    }
    expect(tempo(hast)).toBeGreaterThan(tempo(roh))
  })

  it('Enge: das Rissfenster schrumpft, faellt aber nie auf null', () => {
    const s = lauf(3, 'enge')
    s.gegner.alleFreigeben()
    const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
    if (g === null) throw new Error('kein Platz')

    rissSetzen(g, 0, s.spieler.rissDauer)
    expect(g.risseZeit).toBeLessThan(RISS_FENSTER)
    expect(g.risseZeit).toBeGreaterThanOrEqual(RISS_MINDEST)

    // Und selbst ein absurder Abzug laesst die Kernregel noch ausloesen.
    rissSetzen(g, 1, -99)
    expect(g.risseZeit).toBe(RISS_MINDEST)
  })

  it('Kargheit: ein Platz weniger, aber nie unter der Zersplitterungs-Schwelle', () => {
    const roh = lauf(3)
    const s = lauf(3, 'kargheit')
    // `MAX_WAFFEN` ist die harte Grenze (sechs, erreichbar ueber "Duennhaeutig"),
    // der Startguertel ist kleiner. Kargheit nimmt vom Startguertel.
    expect(s.spieler.maxWaffen).toBe(roh.spieler.maxWaffen - 1)
    expect(roh.spieler.maxWaffen).toBeLessThanOrEqual(MAX_WAFFEN)

    // Die Prismatikerin traegt nur drei - ihr darf keiner mehr genommen werden,
    // sonst kann sie die Kernregel gar nicht mehr ausloesen.
    const eng = erzeugeSpielstand(3)
    eng.verhexungen = ['kargheit']
    eng.offen.push('prismatikerin')
    starteLauf(eng, 3, { ...eng.charakter, anwenden: (sp) => (sp.maxWaffen = 3) })
    expect(eng.spieler.maxWaffen).toBe(3)
  })

  it('Blindheit: die Karte bleibt aus', () => {
    expect(lauf(3, 'blindheit').blind).toBe(true)
    expect(lauf(3).blind).toBe(false)
  })

  it('Zoll: jede Etappe kostet maximale Leben', () => {
    const s = lauf(3, 'zoll')
    const vorher = s.spieler.maxHp
    s.etappe = 1
    s.etappeVorbei = true
    tick(s, leereBefehle(), TICK_DT)
    expect(s.phase).toBe('atempause')
    const b = leereBefehle()
    b.wahl = 0
    tick(s, b, TICK_DT)
    expect(s.spieler.maxHp).toBe(vorher - ZOLL_PRO_ETAPPE)
    expect(s.spieler.hp).toBeLessThanOrEqual(s.spieler.maxHp)
  })

  it('Gezeichnet: doppelt so viele Zeichen', () => {
    const roh = lauf(3)
    const hex = lauf(3, 'gezeichnet')
    roh.etappe = 3
    hex.etappe = 3
    expect(zeichenAnteil(hex)).toBeCloseTo(zeichenAnteil(roh) * 2, 6)
  })
})

describe('Bedienung auf dem Titelbild', () => {
  it('wechselt mit W/S die Reihe und schaltet mit Leertaste um', () => {
    const s = erzeugeSpielstand(5)
    expect(s.phase).toBe('titel')

    const runter = leereBefehle()
    runter.runter = true
    tick(s, runter, TICK_DT)
    expect(s.titelZeile).toBe(1)

    const platz = leereBefehle()
    platz.bestaetigen = true
    tick(s, platz, TICK_DT)
    expect(s.verhexungen).toEqual([VERHEXUNGEN[0].id])
    // Und der Lauf hat *nicht* gestartet: In der Verhexungsreihe schaltet die
    // Leertaste um, sie startet nicht.
    expect(s.phase).toBe('titel')

    // Noch einmal nimmt sie wieder weg.
    tick(s, platz, TICK_DT)
    expect(s.verhexungen).toEqual([])

    const hoch = leereBefehle()
    hoch.hoch = true
    tick(s, hoch, TICK_DT)
    expect(s.titelZeile).toBe(0)
    tick(s, platz, TICK_DT)
    expect(s.phase).toBe('laufend')
  })

  it('nimmt die gewaehlten Verhexungen in den Lauf mit', () => {
    const s = erzeugeSpielstand(5)
    s.verhexungen = ['hast', 'blindheit']
    const platz = leereBefehle()
    platz.bestaetigen = true
    tick(s, platz, TICK_DT)
    expect(s.phase).toBe('laufend')
    expect(s.tempoFeind).toBeGreaterThan(1)
    expect(s.blind).toBe(true)
  })
})
