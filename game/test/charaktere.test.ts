import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { Rng } from '../src/core/rng'
import {
  CHARAKTERE,
  charakterMit,
  freigeschaltetDurch,
  punkteFuer,
} from '../src/game/charaktere'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { erzeugeSpieler } from '../src/game/player'
import { zersplitterBereit } from '../src/game/risse'
import { legeGegner } from '../src/game/spawner'
import type { Spieler, Statistik } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, leereBefehle, starteLauf, tick } from '../src/game/state'
import { istVollendet, MAX_WAFFEN } from '../src/game/weapons'
import { arbeiteKaskadeAb, PLATZ_ANZAHL, verletzeGegner } from '../src/game/welt'

/**
 * Charaktere, Punkte und die Auswertung am Ende.
 *
 * Der wichtigste Test dieser Datei ist "keiner ist einfach besser". Er haelt
 * die Regel fest, auf der die ganze Bestenliste steht: Freigeschaltet wird
 * Zugang zu einem Spielstil, nie Rechenkraft. Diese Regel weicht beim
 * Balancing immer als Erstes auf, weil ein Nachteil sich schlecht anfuehlt -
 * und dann misst die Liste nur noch, wer am laengsten gespielt hat.
 */

const RUHE = leereBefehle()

/** Die Grundwerte, an denen sich "besser" ueberhaupt messen laesst. */
function werte(sp: Spieler): Record<string, number> {
  return {
    maxHp: sp.maxHp,
    tempo: sp.tempo * sp.tempoMult,
    schaden: sp.schadenMult,
    magnet: sp.magnetRadius,
    xp: sp.xpMult,
    plaetze: sp.maxWaffen,
  }
}

function angewendet(id: string): Spieler {
  const sp = erzeugeSpieler()
  charakterMit(id).anwenden(sp, new Rng(1))
  return sp
}

function leereStatistik(): Statistik {
  return {
    kills: 0,
    level: 1,
    zeit: 0,
    schaden: 0,
    zersplittert: 0,
    bosse: 0,
    kernGelegt: false,
    schadenProPlatz: new Array<number>(PLATZ_ANZAHL).fill(0),
    platzName: new Array<string>(PLATZ_ANZAHL).fill(''),
    platzFarbe: new Array<string>(PLATZ_ANZAHL).fill(''),
  }
}

describe('Charaktere sind Seitwaertsbewegungen', () => {
  const grund = werte(angewendet('splitter'))

  it('gibt jedem ausser dem Splitter einen benannten Nachteil', () => {
    for (const c of CHARAKTERE) {
      expect(c.vorteil.length).toBeGreaterThan(0)
      if (c.id === 'splitter') continue
      expect(c.nachteil.length).toBeGreaterThan(0)
    }
  })

  it('macht keinen in allen Grundwerten besser als den Splitter', () => {
    for (const c of CHARAKTERE) {
      if (c.id === 'splitter') continue
      const eigen = werte(angewendet(c.id))
      const schlechter = Object.keys(grund).filter((k) => eigen[k] < grund[k])
      // Mindestens ein Grundwert muss unter dem Splitter liegen. Waffen und
      // Sondermechaniken duerfen darueber hinaus alles Moegliche geben - der
      // Preis muss aber in den Zahlen stehen und nicht nur im Text.
      expect(schlechter.length, `${c.id} zahlt keinen Preis`).toBeGreaterThan(0)
    }
  })

  it('gleicht die schwereren ueber den Punktefaktor aus', () => {
    expect(charakterMit('splitter').punkteFaktor).toBe(1)
    for (const c of CHARAKTERE) {
      // Nie unter eins: Ein Charakter darf schwerer sein, aber der Faktor darf
      // ihn nie *bestrafen* - sonst waere er zweimal im Nachteil.
      expect(c.punkteFaktor).toBeGreaterThanOrEqual(1)
      expect(c.punkteFaktor).toBeLessThanOrEqual(1.6)
    }
    // Der mit den wenigsten Lebenspunkten muss mehr wert sein als der Grund.
    expect(charakterMit('riss').punkteFaktor).toBeGreaterThan(1)
  })

  it('haelt sich an die Obergrenze des Guertels', () => {
    for (const c of CHARAKTERE) {
      const sp = angewendet(c.id)
      expect(sp.maxWaffen).toBeGreaterThan(0)
      expect(sp.maxWaffen).toBeLessThanOrEqual(MAX_WAFFEN)
      expect(sp.waffen.length).toBeLessThanOrEqual(sp.maxWaffen)
      for (const w of sp.waffen) expect(w.platz).toBeLessThan(sp.maxWaffen)
    }
  })

  it('gibt der Prismatikerin wirklich etwas Legendaeres', () => {
    // Drei Plaetze sind genau die Zersplitterungs-Schwelle - der Startvorteil
    // muss das aufwiegen, sonst ist sie nur schlechter.
    for (let saat = 1; saat < 20; saat++) {
      const sp = erzeugeSpieler()
      charakterMit('prismatikerin').anwenden(sp, new Rng(saat))
      expect(sp.maxWaffen).toBe(3)
      expect(sp.waffen.length).toBe(1)
      expect(sp.waffen[0].def.seltenheit).toBe('legendaer')
      expect(sp.waffen[0].stufe).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('Der Riss-Charakter', () => {
  it('zersplittert mit zwei Waffen, sobald der Stillstand steht', () => {
    const s = erzeugeSpielstand(11)
    starteLauf(s, 11, charakterMit('riss'))
    s.gegner.alleFreigeben()
    gitterAufbauen(s)

    const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
    if (g === null) throw new Error('kein Gegner')

    expect(s.spieler.stillstandSchwelle).toBeGreaterThan(0)
    s.spieler.stillstand = s.spieler.stillstandSchwelle

    verletzeGegner(s, g, 1, 0, false, 0, 0)
    verletzeGegner(s, g, 1, 1, false, 0, 0)
    // Zwei Waffen plus Geisterriss - das ist die Schwelle. Geprueft wird die
    // Vormerkung, nicht `zersplitterBereit`: Der Schaden merkt selbst vor und
    // setzt dabei das Kennzeichen, das die Abfrage danach wieder sperrt.
    expect(g.risse).toBe(3)
    expect(g.zersplittert).toBe(true)
  })

  it('setzt keinen Geisterriss, wenn man gerade getroffen wurde', () => {
    const s = erzeugeSpielstand(11)
    starteLauf(s, 11, charakterMit('riss'))
    s.gegner.alleFreigeben()
    gitterAufbauen(s)

    const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
    if (g === null) throw new Error('kein Gegner')

    s.spieler.stillstand = 0
    verletzeGegner(s, g, 1, 0, false, 0, 0)
    verletzeGegner(s, g, 1, 1, false, 0, 0)
    expect(g.risse).toBe(2)
    expect(g.zersplittert).toBe(false)
    expect(zersplitterBereit(g)).toBe(false)
  })
})

describe('Freischaltung', () => {
  it('gibt zu Beginn nur den Splitter frei', () => {
    const s = erzeugeSpielstand(3)
    expect(s.offen).toEqual(['splitter'])
    expect(CHARAKTERE.filter((c) => c.bedingung === null).map((c) => c.id)).toEqual(['splitter'])
  })

  it('erkennt jede Bedingung an einem Lauf, der sie erfuellt', () => {
    const sp = erzeugeSpieler()
    const st = leereStatistik()
    expect(freigeschaltetDurch(st, sp)).toEqual([])

    st.kills = 500
    st.level = 25
    st.zersplittert = 250
    st.zeit = 300
    st.kernGelegt = true
    const waffe = charakterMit('schleiferin')
    waffe.anwenden(sp, new Rng(1))
    for (const w of sp.waffen) w.stufe = w.def.maxStufe
    expect(sp.waffen.some((w) => istVollendet(w.def, w.stufe))).toBe(true)

    const offen = freigeschaltetDurch(st, sp)
    for (const c of CHARAKTERE) {
      if (c.bedingung === null) continue
      expect(offen, `${c.id} fehlt`).toContain(c.id)
    }
  })

  it('haelt einen frisch freigeschalteten Lauf trotzdem bei null', () => {
    // Der Kern der Regel: Freischalten gibt Zugang, keine Werte. Ein Lauf mit
    // allen offenen Charakteren startet genauso wie der allererste.
    const frisch = erzeugeSpielstand(5)
    starteLauf(frisch, 5, charakterMit('splitter'))

    const spaet = erzeugeSpielstand(5)
    spaet.offen = CHARAKTERE.map((c) => c.id)
    spaet.bestwert = 999_999
    starteLauf(spaet, 5, charakterMit('splitter'))

    expect(spaet.spieler.maxHp).toBe(frisch.spieler.maxHp)
    expect(spaet.spieler.schadenMult).toBe(frisch.spieler.schadenMult)
    expect(spaet.spieler.tempo).toBe(frisch.spieler.tempo)
    expect(spaet.spieler.waffen.length).toBe(frisch.spieler.waffen.length)
    expect(spaet.statistik.kills).toBe(0)
  })

  it('setzt den Bestwert und die Freischaltungen ueber den Tod hinweg nicht zurueck', () => {
    const s = erzeugeSpielstand(5)
    s.offen = ['splitter', 'koloss']
    s.bestwert = 4200
    starteLauf(s, 5, charakterMit('splitter'))
    expect(s.offen).toContain('koloss')
    expect(s.bestwert).toBe(4200)
  })
})

describe('Punkte', () => {
  it('steigen mit jedem Bestandteil', () => {
    const st = leereStatistik()
    const grund = punkteFuer(st, 1)
    for (const feld of ['zeit', 'kills', 'level', 'zersplittert', 'bosse'] as const) {
      const mehr = leereStatistik()
      mehr[feld] = 10
      expect(punkteFuer(mehr, 1), feld).toBeGreaterThan(grund)
    }
  })

  it('wiegt Zeit schwerer als Kills', () => {
    // "Wie weit bin ich gekommen" ist die Frage, die eine Liste beantworten
    // soll - nicht "wie viel habe ich abgeraeumt".
    const zeit = leereStatistik()
    zeit.zeit = 100
    const kills = leereStatistik()
    kills.kills = 100
    expect(punkteFuer(zeit, 1)).toBeGreaterThan(punkteFuer(kills, 1))
  })

  it('rechnet den Charakterfaktor auf das Ganze', () => {
    const st = leereStatistik()
    st.zeit = 300
    st.kills = 1200
    expect(punkteFuer(st, 1.4)).toBe(Math.round(punkteFuer(st, 1) * 1.4))
  })
})

describe('Schadensauswertung', () => {
  it('verteilt jeden Punkt Schaden auf genau einen Platz', () => {
    const s = erzeugeSpielstand(77)
    starteLauf(s, 77)
    for (let i = 0; i < 3600; i++) tick(s, RUHE, TICK_DT)

    const summe = s.statistik.schadenProPlatz.reduce((a, b) => a + b, 0)
    expect(s.statistik.schaden).toBeGreaterThan(0)
    // Auf ein Rundungshaar genau: Ein Balkendiagramm, dessen Summe nicht dem
    // Gesamtwert entspricht, luegt den Spieler an.
    expect(Math.abs(summe - s.statistik.schaden)).toBeLessThan(1)
  })

  it('beschriftet jeden belegten Platz vom ersten Tick an', () => {
    // Der stille Fehler, gegen den dieser Test steht: `starteLauf` hat die
    // Plaetze beschriftet und danach die Statistik ausgetauscht - die Namen
    // waren sofort wieder weg, und die Auswertung zeigte "Platz 1" statt
    // "Splitterwerfer". Sichtbar wurde das erst auf einem Screenshot.
    for (const c of CHARAKTERE) {
      const s = erzeugeSpielstand(8)
      starteLauf(s, 8, charakterMit(c.id))
      for (const w of s.spieler.waffen) {
        expect(s.statistik.platzName[w.platz], `${c.id}/${w.def.id}`).toBe(w.def.name)
        expect(s.statistik.platzFarbe[w.platz]).toBe(w.def.farbe)
      }
      // Und die reservierten Plaetze tragen ihre festen Namen.
      expect(s.statistik.platzName[MAX_WAFFEN]).toBe('Scherben')
      expect(s.statistik.platzName[MAX_WAFFEN + 1]).toBe('Geisterriss')
      expect(s.statistik.platzName[MAX_WAFFEN + 2]).toBe('Dornen')
    }
  })

  it('bucht die Zersplitterung auf das Scherbenkonto', () => {
    const s = erzeugeSpielstand(12)
    starteLauf(s, 12)
    s.gegner.alleFreigeben()
    gitterAufbauen(s)

    const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
    if (g === null) throw new Error('kein Gegner')
    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, g, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)

    expect(s.statistik.schadenProPlatz[MAX_WAFFEN]).toBeGreaterThan(0)
  })
})
