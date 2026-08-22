import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { BOSSE, bossTick, rufeKern } from '../src/game/bosse'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { legeGegner } from '../src/game/spawner'
import { KERN_ETAPPE, KERN_KITT_TAKT, KERN_PUNKTE } from '../src/game/kern'
import type { Gegner, Spielstand } from '../src/game/state'
import {
  beendeLauf,
  erzeugeSpielstand,
  gitterAufbauen,
  leereBefehle,
  starteLauf,
  tick,
} from '../src/game/state'
import { arbeiteKaskadeAb, verletzeGegner } from '../src/game/welt'

/**
 * Der Kern.
 *
 * Er ist das Ende, das dem Spiel gefehlt hat - und der einzige Gegner, der
 * *nur* an der Kernregel faellt. Diese Datei haelt beides fest: dass er sich
 * gewoehnlichem Schaden verweigert, und dass er trotzdem keine Sackgasse ist.
 */

function feldMitKern(saat = 3): { s: Spielstand; k: Gegner } {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  s.gezeichnet = 0
  s.spieler.waffen = []
  s.spieler.maxHp = 1e9
  s.spieler.hp = 1e9
  const k = rufeKern(s)
  if (k === null) throw new Error('Kern kam nicht')
  gitterAufbauen(s)
  return { s, k }
}

/** Drei verschiedene Waffen darauf - genau das, was ihn allein legt. */
function zersplittere(s: Spielstand, k: Gegner): void {
  for (let platz = 0; platz < 3; platz++) verletzeGegner(s, k, 1, platz, false, 0, 0)
  arbeiteKaskadeAb(s)
}

describe('Der Kern faellt nur an der Kernregel', () => {
  it('nimmt gewoehnlichen Schaden nur zu einem Bruchteil', () => {
    const { s, k } = feldMitKern()
    const voll = k.maxHp
    // Ein Schlag, der jeden anderen Boss doppelt umbringen wuerde.
    verletzeGegner(s, k, voll * 2, 0, false, 0, 0)
    expect(k.tot).toBe(false)
    expect(k.hp).toBeGreaterThan(0)
  })

  it('verliert bei jeder Zersplitterung einen festen Anteil', () => {
    const { s, k } = feldMitKern()
    const voll = k.maxHp
    zersplittere(s, k)
    const weg = voll - k.hp
    // Zwoelf Prozent, plus der Krumen aus den drei Treffern selbst.
    expect(weg / voll).toBeGreaterThan(0.1)
    expect(weg / voll).toBeLessThan(0.2)
  })

  it('faellt nach einer ueberschaubaren Zahl von Zersplitterungen', () => {
    const { s, k } = feldMitKern()
    let runden = 0
    while (!k.tot && runden < 40) {
      zersplittere(s, k)
      runden++
    }
    expect(k.tot).toBe(true)
    // Nicht in zwei, nicht in dreissig: Der Kampf soll eine Laenge haben.
    expect(runden).toBeGreaterThanOrEqual(5)
    expect(runden).toBeLessThanOrEqual(14)
  })

  it('ist keine Sackgasse - auch ohne Mischung geht er irgendwann zu Boden', () => {
    /*
     * Die Fairness-Klausel.
     *
     * Ein Endgegner, den ein Bau grundsaetzlich nicht legen kann, macht aus
     * einem verlorenen Lauf einen ungueltigen. Die zehn Prozent sind langsam,
     * aber sie sind nicht null.
     */
    const { s, k } = feldMitKern()
    for (let i = 0; i < 4000 && !k.tot; i++) verletzeGegner(s, k, k.maxHp * 0.02, 0, false, 0, 0)
    expect(k.tot).toBe(true)
  })
})

describe('Die Selbstkittung', () => {
  it('loescht alle Risse - und kuendigt sich vorher an', () => {
    const { s, k } = feldMitKern()
    const z = k.bossZustand
    if (z === null) throw new Error('kein Bosszustand')

    verletzeGegner(s, k, 1, 0, false, 0, 0)
    verletzeGegner(s, k, 1, 1, false, 0, 0)
    expect(k.risse).toBe(2)

    // Bis kurz vor die Kittung laufen: Die Vorwarnung muss vorher stehen.
    z.kittRest = 0.4
    tick(s, leereBefehle(), TICK_DT)
    expect(z.kittGemeldet).toBe(true)
    expect(k.risse).toBe(2)

    z.kittRest = 0.001
    tick(s, leereBefehle(), TICK_DT)
    expect(k.risse).toBe(0)
    // Und der Takt laeuft wieder von vorn.
    expect(z.kittRest).toBeCloseTo(KERN_KITT_TAKT, 1)
    expect(z.kittGemeldet).toBe(false)
  })

  it('nimmt dabei weder Leben noch gibt es welches zurueck', () => {
    const { s, k } = feldMitKern()
    const z = k.bossZustand
    if (z === null) throw new Error('kein Bosszustand')
    const vorher = k.hp
    z.kittRest = 0.001
    tick(s, leereBefehle(), TICK_DT)
    expect(k.hp).toBe(vorher)
  })
})

describe('Die drei Schalen', () => {
  it('bricht dreimal, jedes Mal mit Gnadenfenster und frischem Pulk', () => {
    const { s, k } = feldMitKern()
    const z = k.bossZustand
    if (z === null) throw new Error('kein Bosszustand')
    expect(z.schale).toBe(3)

    const brueche: number[] = []
    for (let i = 0; i < 400 && !k.tot; i++) {
      const vorher = z.schale
      k.hp = Math.max(1, k.hp - k.maxHp * 0.02)
      tick(s, leereBefehle(), TICK_DT)
      if (z.schale !== vorher) {
        brueche.push(z.schale)
        expect(z.unverwundbar).toBeGreaterThan(0)
        expect(s.gegner.anzahl).toBeGreaterThan(1)
      }
    }
    expect(brueche).toEqual([2, 1, 0])
  })

  it('laesst waehrend des Gnadenfensters nichts durch', () => {
    const { s, k } = feldMitKern()
    const z = k.bossZustand
    if (z === null) throw new Error('kein Bosszustand')
    z.unverwundbar = 1
    const vorher = k.hp
    verletzeGegner(s, k, k.maxHp, 0, false, 0, 0)
    expect(k.hp).toBe(vorher)
    expect(k.risse).toBe(0)
  })

  it('faengt mit zwei Angriffen an und lernt je Schale einen dazu', () => {
    const { s, k } = feldMitKern()
    const z = k.bossZustand
    if (z === null) throw new Error('kein Bosszustand')
    // Ein Endgegner, der von der ersten Sekunde an alles auffaehrt, ist nicht
    // schwer, sondern unlesbar.
    const gesehen = new Set<string>()
    for (let i = 0; i < 3000; i++) {
      tick(s, leereBefehle(), TICK_DT)
      if (z.angriff !== null) gesehen.add(z.angriff)
      if (gesehen.size >= 3) break
    }
    expect(gesehen.size).toBeLessThanOrEqual(2)
  })
})

describe('Das Kern-Tor', () => {
  function bisZumTor(): Spielstand {
    const s = erzeugeSpielstand(9)
    starteLauf(s, 9)
    s.etappe = KERN_ETAPPE
    s.etappeVorbei = true
    tick(s, leereBefehle(), TICK_DT)
    return s
  }

  it('stellt nach der sechsten Etappe genau zwei Tueren', () => {
    const s = bisZumTor()
    expect(s.phase).toBe('atempause')
    expect(s.tuerAngebot).toEqual(['kern', 'tiefer'])
  })

  it('"Zum Kern" ruft ihn sofort und gibt keine Karte', () => {
    const s = bisZumTor()
    const b = leereBefehle()
    b.wahl = 0
    tick(s, b, TICK_DT)
    expect(s.phase).toBe('laufend')
    expect(s.gegner.aktiv.some((g) => g.bossZustand?.art.istKern === true)).toBe(true)
  })

  it('"Tiefer ins Feld" erhoeht die Zerruettung und laeuft weiter', () => {
    const s = bisZumTor()
    const b = leereBefehle()
    b.wahl = 1
    tick(s, b, TICK_DT)
    expect(s.zerruettung).toBe(1)
    expect(s.etappe).toBe(KERN_ETAPPE + 1)
    // Zwei bessere Karten: Der Bildschirm steht offen.
    expect(s.phase).toBe('levelup')
  })
})

describe('Sieg und Wertung', () => {
  it('setzt beim Fall des Kerns "gewonnen" und beendet den Lauf', () => {
    const { s, k } = feldMitKern()
    while (!k.tot) zersplittere(s, k)
    tick(s, leereBefehle(), TICK_DT)
    expect(s.gewonnen).toBe(true)
    expect(s.phase).toBe('tot')
  })

  it('rechnet den Kern-Bonus und die Zerruettung in die Punkte', () => {
    const ohne = erzeugeSpielstand(4)
    starteLauf(ohne, 4)
    beendeLauf(ohne)

    const mit = erzeugeSpielstand(4)
    starteLauf(mit, 4)
    mit.gewonnen = true
    beendeLauf(mit)
    expect(mit.punkte - ohne.punkte).toBe(KERN_PUNKTE)

    const tief = erzeugeSpielstand(4)
    starteLauf(tief, 4)
    tief.gewonnen = true
    tief.zerruettung = 2
    beendeLauf(tief)
    // Zwei Stufen Zerruettung sind der doppelte Wert.
    expect(tief.punkte).toBe(mit.punkte * 2)
  })

  it('macht die Zerruettung Gegner spuerbar zaeher', () => {
    const zaeh = (stufe: number): number => {
      const s = erzeugeSpielstand(4)
      starteLauf(s, 4)
      s.gegner.alleFreigeben()
      s.zerruettung = stufe
      const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
      if (g === null) throw new Error('kein Platz')
      return g.maxHp
    }
    expect(zaeh(2)).toBeGreaterThan(zaeh(0) * 1.5)
  })
})

describe('Flickwerk - die Generalprobe fuer den Kern', () => {
  it('steht in der Bossreihe und flickt sowohl sich als auch andere', () => {
    const f = BOSSE.find((b) => b.id === 'flickwerk')
    expect(f).toBeDefined()
    expect(f?.flickRadius).toBeGreaterThan(0)
    expect(f?.kittTakt).toBeGreaterThan(0)
  })

  it('schliesst die Risse der Gegner um sich herum', () => {
    const s = erzeugeSpielstand(13)
    starteLauf(s, 13)
    s.gegner.alleFreigeben()
    s.gezeichnet = 0
    s.spieler.waffen = []

    const opfer = legeGegner(s, GEGNER_ARTEN[0], 300, 0)
    if (opfer === null) throw new Error('kein Platz')
    opfer.risse = 2
    opfer.risseMaske = 0b11
    opfer.risseZeit = 99

    const boss = legeGegner(s, GEGNER_ARTEN[0], 320, 0)
    if (boss === null) throw new Error('kein Platz')
    const art = BOSSE.find((b) => b.id === 'flickwerk')
    if (art === undefined) throw new Error('Flickwerk fehlt')
    boss.bossZustand = {
      art,
      phase: 1,
      angriff: null,
      telegraf: 0,
      abkling: 99,
      zielX: 0,
      zielY: 0,
      sturmRest: 0,
      sturmVx: 0,
      sturmVy: 0,
      schale: 0,
      kittRest: 99,
      kittGemeldet: false,
      unverwundbar: 0,
    }
    gitterAufbauen(s)
    boss.takt = 0
    bossTick(s, boss, TICK_DT)

    expect(opfer.risse).toBe(0)
  })
})
