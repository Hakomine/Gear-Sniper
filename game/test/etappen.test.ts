import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { bossWelle, findeBoss, naechsteBossZeit } from '../src/game/bosse'
import { KERN_TUEREN, leereEtappenWerte, TUEREN, tuerMit } from '../src/game/etappen'
import { erzeugeSpieler } from '../src/game/player'
import type { Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, leereBefehle, starteLauf, tick } from '../src/game/state'
import { arbeiteKaskadeAb, verletzeGegner } from '../src/game/welt'

/**
 * Etappen und die Türen dazwischen.
 *
 * Der wichtigste Test ist "keine Tuer ist reiner Gewinn". Genau diese Regel
 * weicht beim Balancing als Erstes auf, weil ein Preis sich schlecht anfuehlt -
 * und mit ihr verschwindet die Entscheidung, fuer die die Pause ueberhaupt da
 * ist.
 */

function laufMitBoss(saat = 12): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  s.zeit = naechsteBossZeit(s.bossNummer)
  bossWelle(s)
  return s
}

/** Boss umbringen und einen Tick laufen lassen, damit aufgeraeumt wird. */
function legeBossUm(s: Spielstand): void {
  gitterAufbauen(s)
  for (const g of [...s.gegner.aktiv]) {
    if (g.bossZustand !== null) verletzeGegner(s, g, g.maxHp * 4, 0, false, 0, 0)
  }
  arbeiteKaskadeAb(s)
  tick(s, leereBefehle(), TICK_DT)
}

describe('Türen sind Handel, kein Geschenk', () => {
  it('gibt jeder Tür einen Lohn', () => {
    for (const t of TUEREN) expect(t.lohn.length, t.id).toBeGreaterThan(0)
  })

  it('gibt jeder Tür außer der sicheren einen echten Preis', () => {
    for (const t of TUEREN) {
      if (t.id === 'ruhe') continue
      /*
       * Die beiden Kern-Tueren sind keine Etappentueren.
       *
       * Sie drehen an keiner Stellschraube der naechsten Etappe, sondern
       * entscheiden, ob es ueberhaupt eine naechste gibt. Ihr Preis steht
       * deshalb nicht in `anwenden`, sondern in `state.ts` - und wird weiter
       * unten eigens geprueft.
       */
      if (KERN_TUEREN.includes(t.id)) {
        expect(t.preis.length, t.id).toBeGreaterThan(0)
        continue
      }
      expect(t.preis.length, t.id).toBeGreaterThan(0)

      // Und der Preis steht nicht nur im Text: Er veraendert messbar etwas.
      const werte = leereEtappenWerte()
      const sp = erzeugeSpieler()
      t.anwenden(werte, sp)
      const veraendert =
        werte.nachschub !== 1 ||
        werte.zaehigkeit !== 1 ||
        werte.bosse !== 1 ||
        werte.rissZerfall !== 1 ||
        werte.splitterWeite !== 1 ||
        sp.schadenNimmt !== 1
      expect(veraendert, `${t.id} kostet nichts Messbares`).toBe(true)
    }
  })

  it('haelt die sichere Tür klein, aber nicht leer', () => {
    const ruhe = tuerMit('ruhe')
    expect(ruhe.preis).toBe('')
    expect(ruhe.karten).toBe(1)
    expect(ruhe.gute).toBe(false)
  })
})

describe('Die Atempause', () => {
  it('öffnet sich, wenn der Boss der Etappe fällt', () => {
    const s = laufMitBoss()
    expect(s.phase).toBe('laufend')
    legeBossUm(s)

    expect(s.phase).toBe('atempause')
    expect(s.tuerAngebot.length).toBe(3)
    // Die sichere Wahl steht immer dabei.
    expect(s.tuerAngebot).toContain('ruhe')
    // Und keine zweimal.
    expect(new Set(s.tuerAngebot).size).toBe(3)
  })

  it('laesst waehrenddessen nichts weiterlaufen', () => {
    const s = laufMitBoss()
    legeBossUm(s)
    const zeit = s.zeit
    for (let i = 0; i < 60; i++) tick(s, leereBefehle(), TICK_DT)
    expect(s.zeit).toBe(zeit)
  })

  it('zaehlt die Etappe hoch und reicht die Karten durch', () => {
    const s = laufMitBoss()
    legeBossUm(s)
    expect(s.etappe).toBe(1)

    // "Gedränge" bringt zwei Karten - also zwei Bildschirme nacheinander.
    s.tuerAngebot = ['gedraenge', 'ruhe', 'ruhe']
    s.tuerWahl = 0
    const b = leereBefehle()
    b.bestaetigen = true
    tick(s, b, TICK_DT)

    expect(s.etappe).toBe(2)
    expect(s.phase).toBe('levelup')
    expect(s.etappenWerte.nachschub).toBe(2)

    // Erste Karte nehmen: Es bleibt eine offen.
    tick(s, b, TICK_DT)
    expect(s.phase).toBe('levelup')
    // Zweite Karte nehmen: zurueck ins Getuemmel.
    tick(s, b, TICK_DT)
    expect(s.phase).toBe('laufend')
    expect(s.kartenSchuld).toBe(0)
  })
})

describe('Was eine Tür bewirkt', () => {
  it('gilt nur für die nächste Etappe', () => {
    const s = laufMitBoss()
    legeBossUm(s)
    s.tuerAngebot = ['sproedigkeit', 'ruhe', 'ruhe']
    s.tuerWahl = 0
    const b = leereBefehle()
    b.bestaetigen = true
    tick(s, b, TICK_DT)
    expect(s.etappenWerte.rissZerfall).toBe(2)

    // Naechste Etappe, diesmal die sichere Tuer: Der Wert ist wieder weg.
    while (s.phase === 'levelup') tick(s, b, TICK_DT)
    s.phase = 'atempause'
    s.tuerAngebot = ['ruhe', 'gedraenge', 'zwillinge']
    s.tuerWahl = 0
    tick(s, b, TICK_DT)
    expect(s.etappenWerte.rissZerfall).toBe(1)
    expect(s.etappenWerte.splitterWeite).toBe(1)
  })

  it('laesst nur "Dünnhäutig" dauerhaft wirken', () => {
    const s = laufMitBoss()
    legeBossUm(s)
    const plaetze = s.spieler.maxWaffen
    s.tuerAngebot = ['duennhaeutig', 'ruhe', 'ruhe']
    s.tuerWahl = 0
    const b = leereBefehle()
    b.bestaetigen = true
    tick(s, b, TICK_DT)

    expect(s.spieler.maxWaffen).toBe(plaetze + 1)
    expect(s.spieler.schadenNimmt).toBe(2)

    // Auch nach einer weiteren Etappe mit sicherer Tuer bleibt beides.
    while (s.phase === 'levelup') tick(s, b, TICK_DT)
    s.phase = 'atempause'
    s.tuerAngebot = ['ruhe', 'gedraenge', 'zwillinge']
    tick(s, b, TICK_DT)
    expect(s.spieler.maxWaffen).toBe(plaetze + 1)
    expect(s.spieler.schadenNimmt).toBe(2)
  })

  it('setzt bei "Zwillinge" wirklich zwei Bosse', () => {
    const s = erzeugeSpielstand(9)
    starteLauf(s, 9)
    s.gegner.alleFreigeben()
    s.etappenWerte.bosse = 2
    s.zeit = naechsteBossZeit(s.bossNummer)
    bossWelle(s)

    const bosse = s.gegner.aktiv.filter((g) => g.bossZustand !== null)
    expect(bosse.length).toBe(2)
  })

  it('beendet die Etappe erst, wenn beide Zwillinge liegen', () => {
    const s = erzeugeSpielstand(9)
    starteLauf(s, 9)
    s.gegner.alleFreigeben()
    s.etappenWerte.bosse = 2
    s.zeit = naechsteBossZeit(s.bossNummer)
    bossWelle(s)
    gitterAufbauen(s)

    const bosse = s.gegner.aktiv.filter((g) => g.bossZustand !== null)
    verletzeGegner(s, bosse[0], bosse[0].maxHp * 4, 0, false, 0, 0)
    arbeiteKaskadeAb(s)
    tick(s, leereBefehle(), TICK_DT)
    expect(s.phase).toBe('laufend')
    expect(findeBoss(s)).not.toBeNull()
  })
})

describe('Punkte', () => {
  it('zählen die geschafften Etappen mit', () => {
    const a = erzeugeSpielstand(4)
    starteLauf(a, 4)
    a.spieler.hp = 0
    tick(a, leereBefehle(), TICK_DT)

    const b = erzeugeSpielstand(4)
    starteLauf(b, 4)
    b.etappe = 5
    b.spieler.hp = 0
    tick(b, leereBefehle(), TICK_DT)

    expect(b.punkte).toBeGreaterThan(a.punkte)
  })
})
