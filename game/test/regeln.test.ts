import { describe, expect, it } from 'vitest'
import { Rng } from '../src/core/rng'
import { berechneSchaden, xpFuerLevel } from '../src/game/damage'
import { erzeugeSpieler } from '../src/game/player'
import { VERHALTEN } from '../src/game/verhalten'
import { PASSIVE } from '../src/game/upgrades'
import {
  istVollendet,
  stufenText,
  WAFFEN,
  werteFuer,
  ruesteAus,
  werteAuf,
} from '../src/game/weapons'

describe('Schadensrechnung', () => {
  it('rechnet den Multiplikator ein', () => {
    expect(berechneSchaden(10, 2, 0, 2, new Rng(1)).wert).toBe(20)
  })

  it('faellt nie auf null', () => {
    // Ein Treffer, der nichts tut, liest sich als Fehler im Spiel - selbst
    // wenn die Rechnung stimmt.
    expect(berechneSchaden(1, 0.01, 0, 2, new Rng(1)).wert).toBe(1)
  })

  it('meldet nie einen Krit bei Chance null', () => {
    const rng = new Rng(5)
    for (let i = 0; i < 500; i++) {
      expect(berechneSchaden(10, 1, 0, 3, rng).krit).toBe(false)
    }
  })

  it('trifft die vorgegebene Kritrate ungefaehr', () => {
    const rng = new Rng(20260818)
    let krits = 0
    const laeufe = 20000
    for (let i = 0; i < laeufe; i++) {
      if (berechneSchaden(10, 1, 0.25, 2, rng).krit) krits++
    }
    expect(krits / laeufe).toBeGreaterThan(0.23)
    expect(krits / laeufe).toBeLessThan(0.27)
  })
})

describe('XP-Schwellen', () => {
  it('steigen streng monoton', () => {
    for (let level = 1; level < 200; level++) {
      expect(xpFuerLevel(level + 1)).toBeGreaterThan(xpFuerLevel(level))
    }
  })

  it('halten die erste Stufe billig', () => {
    expect(xpFuerLevel(1)).toBeLessThanOrEqual(10)
  })
})

describe('Waffendaten', () => {
  it('sind alle plausibel', () => {
    for (const def of WAFFEN) {
      expect(def.maxStufe, def.id).toBeGreaterThanOrEqual(2)
      expect(def.farbe, def.id).toMatch(/^#[0-9a-f]{6}$/i)
      // Jede Kennung muss auch ein Verhalten haben, sonst feuert die Waffe nie.
      expect(VERHALTEN[def.verhalten], def.id).toBeDefined()
    }
  })

  it('geben jeder Waffe mit Abklingzeit auch etwas zu tun', () => {
    /*
     * Nur Waffen, die *auf Abklingzeit* ausloesen, brauchen eine. Schleifband,
     * Fadenkreuz, Spiegelscherbe und Bohrkopf wirken in jedem Tick - fuer sie
     * waere eine Abklingzeit eine Zahl ohne Wirkung, und eine Zahl ohne
     * Wirkung ist schlimmer als keine.
     */
    for (const def of WAFFEN) {
      const v = VERHALTEN[def.verhalten]
      if (v.feuern === undefined) {
        expect(v.dauernd, `${def.id} tut gar nichts`).toBeDefined()
        continue
      }
      expect(def.basis.abklingzeit, def.id).toBeGreaterThan(0)
    }
  })

  it('geben jeder Waffe eigenen Schaden - ausser dem Kaleidoskop', () => {
    // Das Kaleidoskop ist die eine bewusste Ausnahme: Es hat keinen eigenen
    // Schaden, weil es fremden austeilt. Genau das ist seine Idee.
    for (const def of WAFFEN) {
      if (def.verhalten === 'kaleidoskop') {
        expect(def.basis.schaden, def.id).toBe(0)
        continue
      }
      expect(def.basis.schaden, def.id).toBeGreaterThan(0)
    }
  })

  it('haben eindeutige Kennungen', () => {
    const ids = new Set(WAFFEN.map((w) => w.id))
    expect(ids.size).toBe(WAFFEN.length)
  })

  it('haben jede eine Vollendung mit Text', () => {
    // Der Moment auf der letzten Stufe ist der, der haengenbleibt. Eine Waffe
    // ohne ihn waere eine Waffe, die am Ende nur noch groessere Zahlen macht.
    for (const def of WAFFEN) {
      expect(def.vollendung.text.length, def.id).toBeGreaterThan(5)
    }
  })

  it('decken alle vier Seltenheiten ab', () => {
    const stufen = new Set(WAFFEN.map((w) => w.seltenheit))
    expect(stufen).toEqual(new Set(['gewoehnlich', 'selten', 'episch', 'legendaer']))
  })
})

describe('Stufenwerte', () => {
  it('steigern den Schaden streng monoton', () => {
    for (const def of WAFFEN) {
      // Das Kaleidoskop hat keinen eigenen Schaden - es waechst ueber seine
      // Spiegelstaerke, und die wird gleich darunter geprueft.
      if (def.basis.schaden === 0) continue
      for (let stufe = 1; stufe < def.maxStufe; stufe++) {
        expect(werteFuer(def, stufe + 1).schaden, `${def.id} ${stufe}`).toBeGreaterThan(
          werteFuer(def, stufe).schaden,
        )
      }
    }
  })

  it('halten die Abklingzeit ueber null', () => {
    // Eine Abklingzeit von null wuerde jeden Tick feuern und die Schleife
    // fluten - die Untergrenze in `werteFuer` ist kein Schmuck.
    for (const def of WAFFEN) {
      expect(werteFuer(def, def.maxStufe).abklingzeit, def.id).toBeGreaterThan(0)
    }
  })

  it('liefern Stueckzahlen ganzzahlig', () => {
    for (const def of WAFFEN) {
      for (let stufe = 1; stufe <= def.maxStufe; stufe++) {
        const w = werteFuer(def, stufe)
        expect(Number.isInteger(w.anzahl), `${def.id} anzahl`).toBe(true)
        expect(Number.isInteger(w.durchschlag), `${def.id} durchschlag`).toBe(true)
      }
    }
  })

  it('greifen die Vollendung genau auf der letzten Stufe', () => {
    for (const def of WAFFEN) {
      expect(istVollendet(def, def.maxStufe - 1), def.id).toBe(false)
      expect(istVollendet(def, def.maxStufe), def.id).toBe(true)
    }
  })

  it('zeigen auf der letzten Karte den Vollendungstext', () => {
    for (const def of WAFFEN) {
      expect(stufenText(def, def.maxStufe - 1)).toBe(def.vollendung.text)
    }
  })

  it('erzeugen fuer jede Zwischenstufe einen nicht leeren Text', () => {
    // Der Text wird aus `proStufe` erzeugt. Waere er leer, haette die Karte
    // nichts zu sagen - ein stiller Fehler, den man im Spiel kaum bemerkt.
    for (const def of WAFFEN) {
      for (let stufe = 1; stufe < def.maxStufe - 1; stufe++) {
        expect(stufenText(def, stufe).length, `${def.id} ${stufe}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('Waffeninstanz', () => {
  it('steigt bis zur Maxstufe und nicht darueber', () => {
    const def = WAFFEN[0]
    const w = ruesteAus(def, 0)
    for (let i = 0; i < def.maxStufe + 5; i++) werteAuf(w)
    expect(w.stufe).toBe(def.maxStufe)
  })

  it('rechnet die Werte beim Aufwerten neu', () => {
    const w = ruesteAus(WAFFEN[0], 0)
    const vorher = w.werte.schaden
    werteAuf(w)
    expect(w.werte.schaden).toBeGreaterThan(vorher)
  })

  it('merkt sich den Guertelplatz', () => {
    // Der Platz ist das Bit, unter dem die Waffe ihre Risse setzt - eine
    // Verwechslung waere im Spiel unsichtbar und in der Wirkung fatal.
    expect(ruesteAus(WAFFEN[0], 3).platz).toBe(3)
  })
})

describe('Passive Gegenstaende', () => {
  it('sind ueberwiegend Regeln und nicht Prozente', () => {
    /*
     * Der Vorwurf aus Runde zwei galt den Waffen: "die Upgrades mit Wucht und
     * Abklingzeit sind ziemlich langweilig". Bei den Passiven stand er noch -
     * sieben Eintraege, alle reine Zahlen. Dieser Test haelt fest, dass die
     * Mehrheit jetzt etwas *anderes* macht statt nur mehr.
     */
    const werte = new Set(['panzerplatte', 'laufsohlen', 'notpflaster'])
    const regeln = PASSIVE.filter((p) => !werte.has(p.id))
    expect(regeln.length).toBeGreaterThanOrEqual(12)
    expect(regeln.length).toBeGreaterThan(werte.size * 2)
  })

  it('greifen jede einzeln messbar', () => {
    // Ein Gegenstand, dessen Wirkung sich nicht am Spieler ablesen laesst,
    // waere reine Beschriftung.
    for (const p of PASSIVE) {
      const sp = erzeugeSpieler()
      // Angeschlagen starten: Eine Heilung bei vollem Leben aendert nichts -
      // genau deshalb hat sie ihre `verfuegbar`-Sperre.
      sp.hp = sp.maxHp * 0.5
      const vorher = JSON.stringify(sp)
      p.anwenden(sp)
      expect(JSON.stringify(sp), p.id).not.toBe(vorher)
    }
  })

  it('haelt den Nachhall am Riss und nicht am Schaden fest', () => {
    const sp = erzeugeSpieler()
    PASSIVE.find((p) => p.id === 'nachhall')!.anwenden(sp)
    expect(sp.rissDauer).toBe(1)
    expect(sp.schadenMult).toBe(1)
  })

  it('heilen nie ueber das Maximum hinaus', () => {
    const sp = erzeugeSpieler()
    sp.hp = sp.maxHp - 5
    PASSIVE.find((p) => p.id === 'panzerplatte')!.anwenden(sp)
    expect(sp.hp).toBeLessThanOrEqual(sp.maxHp)
  })

  it('bieten Heilung nur bei Schaden an', () => {
    const sp = erzeugeSpieler()
    const pflaster = PASSIVE.find((p) => p.id === 'notpflaster')!
    expect(pflaster.verfuegbar!(sp)).toBe(false)
    sp.hp = sp.maxHp * 0.5
    expect(pflaster.verfuegbar!(sp)).toBe(true)
  })
})
