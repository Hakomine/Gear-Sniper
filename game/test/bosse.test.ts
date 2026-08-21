import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import {
  bossFuer,
  bossHpFaktor,
  bossTick,
  bossWelle,
  findeBoss,
  naechsteBossZeit,
} from '../src/game/bosse'
import { GEGNER_ARTEN, hpFaktor } from '../src/game/enemies'
import { FUSIONEN } from '../src/game/fusionen'
import { BOSS_ZERSPLITTER_ANTEIL, ZERSPLITTER_ANTEIL } from '../src/game/risse'
import { zieheAngebote } from '../src/game/upgrades'
import type { Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, starteLauf, tick } from '../src/game/state'
import { ruesteAus, WAFFEN, waffeMit } from '../src/game/weapons'
import { legeGegner } from '../src/game/spawner'
import { arbeiteKaskadeAb, verletzeGegner } from '../src/game/welt'

/**
 * Bosse und Verschmelzungen.
 *
 * Zwei Dinge, die man im Spiel nicht sieht, wenn sie kaputt sind: ein Angriff
 * ohne Vorwarnung fuehlt sich nur "unfair" an, und zwei Waffen auf demselben
 * Riss-Platz sehen aus wie ein Balancing-Problem. Deshalb stehen beide hier.
 */

/** Nichts gedrueckt - fuer die Ticks, die diese Tests selbst ausloesen. */
const RUHE = { x: 0, y: 0, bestaetigen: false, links: false, rechts: false, wahl: -1 }

function leererLauf(saat = 7): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  return s
}

/** Boss setzen, ohne 90 Sekunden zu simulieren. */
function setzeBoss(s: Spielstand) {
  s.zeit = naechsteBossZeit(s.bossNummer)
  bossWelle(s)
  const boss = findeBoss(s)
  if (boss === null || boss.bossZustand === null) throw new Error('kein Boss gesetzt')
  return { boss, z: boss.bossZustand }
}

/** Ticks laufen lassen, bis `pruef` zutrifft - oder aufgeben. */
function bisZu(s: Spielstand, ticks: number, pruef: () => boolean): boolean {
  for (let i = 0; i < ticks; i++) {
    const boss = findeBoss(s)
    if (boss !== null) bossTick(s, boss, TICK_DT)
    if (pruef()) return true
  }
  return false
}

describe('Bossauftritt', () => {
  it('kommt erst im Takt und nie zweimal gleichzeitig', () => {
    const s = leererLauf()

    s.zeit = naechsteBossZeit(0) - 1
    bossWelle(s)
    expect(findeBoss(s)).toBeNull()

    s.zeit = naechsteBossZeit(0)
    bossWelle(s)
    expect(findeBoss(s)).not.toBeNull()

    // Zweite Welle faellig, aber der erste liegt noch: Der Takt schiebt sich.
    const vorher = s.bossNummer
    s.zeit = naechsteBossZeit(s.bossNummer)
    bossWelle(s)
    expect(s.bossNummer).toBe(vorher)
  })

  it('hat deutlich mehr Trefferpunkte als ein Wellengegner', () => {
    const s = leererLauf()
    const { boss } = setzeBoss(s)
    const staerkster = Math.max(...GEGNER_ARTEN.map((a) => a.hp))
    expect(boss.maxHp).toBeGreaterThan(staerkster * 10)
  })

  it('reicht die Bosskarte durch, wenn er faellt', () => {
    const s = leererLauf()
    const { boss } = setzeBoss(s)
    gitterAufbauen(s)
    verletzeGegner(s, boss, boss.maxHp * 4, 0, false, 0, 0)
    arbeiteKaskadeAb(s)
    expect(boss.tot).toBe(true)

    // Gezaehlt wird beim Aufraeumen, nicht beim Schaden - also einmal ticken.
    tick(s, RUHE, TICK_DT)
    expect(s.statistik.bosse).toBe(1)
    expect(s.bossKarte).toBe(true)
  })
})

describe('Vorwarnung', () => {
  it('kuendigt jeden Angriff an, bevor er stattfindet', () => {
    const s = leererLauf()
    const { z } = setzeBoss(s)

    // Bis zur ersten Ankuendigung darf nichts fliegen.
    const angekuendigt = bisZu(s, 600, () => z.angriff !== null)
    expect(angekuendigt).toBe(true)
    expect(z.telegraf).toBeGreaterThan(0)
    expect(s.feindSchuesse.aktiv.length).toBe(0)

    // Und danach passiert auch wirklich etwas.
    const ausgefuehrt = bisZu(s, 600, () => z.telegraf <= 0)
    expect(ausgefuehrt).toBe(true)
  })

  it('steht waehrend der Vorwarnung still', () => {
    // Ein Boss, der sich waehrend der Ansage weiterbewegt, macht sie wertlos:
    // Die Markierung liegt dann nicht mehr da, wo er zuschlaegt.
    const s = leererLauf()
    const { boss, z } = setzeBoss(s)
    bisZu(s, 600, () => z.telegraf > 0)
    expect(z.telegraf).toBeGreaterThan(0)

    const x = boss.x
    const y = boss.y
    bossTick(s, boss, TICK_DT)
    expect(boss.x).toBe(x)
    expect(boss.y).toBe(y)
  })
})

describe('Phasenwechsel', () => {
  it('wechselt unter der Schwelle das Muster, nicht nur den Wert', () => {
    const s = leererLauf()
    const { boss, z } = setzeBoss(s)
    expect(z.phase).toBe(1)

    boss.hp = boss.maxHp * (z.art.phaseSchwelle - 0.01)
    bossTick(s, boss, TICK_DT)

    expect(z.phase).toBe(2)
    // Der Wechsel raeumt die laufende Ansage ab - sonst schlaegt noch ein
    // Angriff aus Phase eins ein, waehrend das Bild schon Phase zwei zeigt.
    expect(z.angriff).toBeNull()
    expect(z.telegraf).toBe(0)
  })

  it('wechselt nur einmal', () => {
    const s = leererLauf()
    const { boss, z } = setzeBoss(s)
    boss.hp = 1
    for (let i = 0; i < 30; i++) bossTick(s, boss, TICK_DT)
    expect(z.phase).toBe(2)
  })
})

describe('Der Boss gehorcht der Kernregel', () => {
  it('laesst sich von drei verschiedenen Waffen zersplittern', () => {
    // Das ist die beste Werbung fuer den gemischten Bau: Auch der dickste
    // Gegner im Spiel faellt schneller, wenn drei Waffen ihn aufreissen.
    const s = leererLauf()
    const { boss } = setzeBoss(s)
    gitterAufbauen(s)

    verletzeGegner(s, boss, 10, 0, false, 0, 0)
    verletzeGegner(s, boss, 10, 1, false, 0, 0)
    expect(boss.risse).toBe(2)
    const vorSplitter = boss.hp

    verletzeGegner(s, boss, 10, 2, false, 0, 0)
    arbeiteKaskadeAb(s)

    expect(vorSplitter - boss.hp).toBeGreaterThan(boss.maxHp * BOSS_ZERSPLITTER_ANTEIL * 0.9)
    expect(s.statistik.zersplittert).toBe(1)
  })

  it('nimmt der Zersplitterung beim Boss die Wucht, dafuer geht sie mehrfach', () => {
    // Mit den vollen 60 Prozent war ein Boss nach zwei Splittern erledigt und
    // die zweite Phase praktisch nie zu sehen. Weniger Wucht, dafuer beliebig
    // oft: Der gemischte Bau wird ueber den ganzen Kampf belohnt.
    const s = leererLauf()
    const { boss } = setzeBoss(s)
    gitterAufbauen(s)

    expect(BOSS_ZERSPLITTER_ANTEIL).toBeLessThan(ZERSPLITTER_ANTEIL)

    for (let runde = 0; runde < 3; runde++) {
      for (let platz = 0; platz < 3; platz++) verletzeGegner(s, boss, 1, platz, false, 0, 0)
      arbeiteKaskadeAb(s)
      expect(s.statistik.zersplittert).toBe(runde + 1)
      // Danach ist der Boss wieder unversehrt, was die Risse angeht: Sie
      // muessen komplett neu gesetzt werden.
      expect(boss.risse).toBe(0)
      expect(boss.zersplittert).toBe(false)
    }
  })

  it('laesst einen normalen Gegner nur einmal zerspringen', () => {
    const s = leererLauf()
    gitterAufbauen(s)
    const g = legeGegner(s, GEGNER_ARTEN[GEGNER_ARTEN.length - 1], 0, 0)
    if (g === null) throw new Error('kein Gegner')
    g.hp = 1e6
    g.maxHp = 1e6

    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, g, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)
    expect(g.zersplittert).toBe(true)

    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, g, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)
    expect(s.statistik.zersplittert).toBe(1)
  })
})

describe('Bosskurve', () => {
  it('waechst deutlich flacher als die des Schwarms', () => {
    // Der Fehler, gegen den dieser Test steht: Bosse liefen anfangs auf der
    // quadratischen Schwarmkurve mit. In der zehnten Minute ergab das Faktor
    // 71 und Bosskaempfe von ueber drei Minuten - und weil die naechste Welle
    // wartet, bis der aktuelle liegt, kamen statt sieben Bossen nur drei.
    for (const zeit of [90, 300, 600]) {
      expect(bossHpFaktor(zeit)).toBeLessThan(hpFaktor(zeit))
    }
    expect(bossHpFaktor(600)).toBeLessThan(hpFaktor(600) / 3)
    // Trotzdem monoton - ein spaeter Boss ist immer der haertere.
    expect(bossHpFaktor(600)).toBeGreaterThan(bossHpFaktor(90))
  })
})

describe('Verschmelzen', () => {
  const fusion = FUSIONEN[0]

  function mitEltern(s: Spielstand, voll: boolean): void {
    s.spieler.waffen = []
    fusion.aus.forEach((id, i) => {
      const def = waffeMit(id)
      if (def === undefined) throw new Error(`Waffe ${id} fehlt`)
      const w = ruesteAus(def, i)
      w.stufe = voll ? def.maxStufe : 1
      s.spieler.waffen.push(w)
    })
  }

  it('erscheint nur, wenn beide Eltern ausgereizt sind', () => {
    const s = leererLauf()

    mitEltern(s, false)
    const ohne = zieheAngebote(s, 40)
    expect(ohne.some((a) => a.art === 'fusion')).toBe(false)

    mitEltern(s, true)
    // Gewichtet gezogen - ueber viele Versuche muss die Karte auftauchen.
    let gesehen = false
    for (let i = 0; i < 200 && !gesehen; i++) {
      gesehen = zieheAngebote(s, 3).some((a) => a.id === `fusion:${fusion.def.id}`)
    }
    expect(gesehen).toBe(true)
  })

  it('nimmt beide Eltern weg und setzt eine Waffe an ihre Stelle', () => {
    const s = leererLauf()
    mitEltern(s, true)
    // Eine dritte Waffe, damit sich zeigt, dass wirklich nur die Eltern gehen.
    const dritte = WAFFEN.find((d) => !fusion.aus.includes(d.id))
    if (dritte === undefined) throw new Error('keine dritte Waffe')
    s.spieler.waffen.push(ruesteAus(dritte, 2))

    let karte = null
    for (let i = 0; i < 400 && karte === null; i++) {
      karte = zieheAngebote(s, 3).find((a) => a.id === `fusion:${fusion.def.id}`) ?? null
    }
    if (karte === null) throw new Error('Fusionskarte nicht gezogen')
    karte.anwenden(s)

    const ids = s.spieler.waffen.map((w) => w.def.id)
    expect(ids).not.toContain(fusion.aus[0])
    expect(ids).not.toContain(fusion.aus[1])
    expect(ids).toContain(fusion.def.id)
    expect(ids).toContain(dritte.id)
    // Zwei raus, eine rein: ein Platz wird frei. Genau das ist die Abwaegung.
    expect(s.spieler.waffen.length).toBe(2)
  })

  it('kommt kein zweites Mal, wenn das Ergebnis schon im Guertel liegt', () => {
    // Gemessen an einem echten Lauf: Wer die Eltern spaeter neu zieht und
    // wieder ausreizt, hatte danach dieselbe Fusion zweimal im Guertel.
    const s = leererLauf()
    mitEltern(s, true)
    s.spieler.waffen.push(ruesteAus(fusion.def, 2))

    const angebote = zieheAngebote(s, 60)
    expect(angebote.some((a) => a.id === `fusion:${fusion.def.id}`)).toBe(false)
  })

  it('laesst sich nicht weiter verschmelzen', () => {
    const s = leererLauf()
    s.spieler.waffen = [ruesteAus(fusion.def, 0)]
    s.spieler.waffen[0].stufe = fusion.def.maxStufe
    const angebote = zieheAngebote(s, 40)
    expect(angebote.some((a) => a.art === 'fusion')).toBe(false)
    // Und sie taucht auch nicht als frische Waffe im ersten Topf auf.
    expect(angebote.some((a) => a.id === `waffe:${fusion.def.id}`)).toBe(false)
  })
})

describe('Guertelplaetze', () => {
  it('bleiben nach einer Fusion eindeutig', () => {
    // Der stille Fehler, gegen den dieser Test steht: `platz` ist zugleich das
    // Bit fuer die Risse. Wuerde er als Array-Laenge vergeben, bekaemen nach
    // einer Fusion zwei Waffen dasselbe Bit - und die Kernregel waere im Spiel
    // unsichtbar ausgehebelt.
    const s = leererLauf(99)
    starteLauf(s, 99)

    for (let i = 0; i < 4000; i++) {
      tick(s, RUHE, TICK_DT)
      if (s.phase === 'levelup') {
        // Immer die Fusion nehmen, wenn eine dabei ist - sonst die erste Karte.
        const fus = s.angebote.findIndex((a) => a.art === 'fusion')
        const wahl = fus >= 0 ? fus : 0
        s.angebote[wahl].anwenden(s)
        s.phase = 'laufend'
        s.angebote = []
      }
      const plaetze = s.spieler.waffen.map((w) => w.platz)
      expect(new Set(plaetze).size).toBe(plaetze.length)
      for (const p of plaetze) expect(p).toBeLessThan(s.spieler.maxWaffen)
      if (s.phase === 'tot') break
    }
  })
})

describe('Determinismus mit Bossen', () => {
  it('ergibt bei gleichem Saatwert denselben Boss an derselben Stelle', () => {
    const a = leererLauf(1234)
    const b = leererLauf(1234)
    const eins = setzeBoss(a)
    const zwei = setzeBoss(b)
    expect(eins.z.art.id).toBe(zwei.z.art.id)
    expect(eins.boss.x).toBe(zwei.boss.x)
    expect(eins.boss.y).toBe(zwei.boss.y)
  })

  it('schickt die Bosse in fester Reihenfolge', () => {
    expect(bossFuer(0).id).not.toBe(bossFuer(1).id)
    // Nach dem letzten wiederholt sich der schwerste, statt undefined zu sein.
    expect(bossFuer(99).id).toBe(bossFuer(2).id)
  })
})
