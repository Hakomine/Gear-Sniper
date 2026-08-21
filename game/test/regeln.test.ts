import { describe, expect, it } from 'vitest'
import { Rng } from '../src/core/rng'
import { berechneSchaden, xpFuerLevel } from '../src/game/damage'
import { erzeugeSpieler } from '../src/game/player'
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
      expect(def.basis.schaden, def.id).toBeGreaterThan(0)
      expect(def.basis.abklingzeit, def.id).toBeGreaterThan(0)
      expect(def.maxStufe, def.id).toBeGreaterThanOrEqual(2)
      expect(def.farbe, def.id).toMatch(/^#[0-9a-f]{6}$/i)
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
  it('veraendern genau den Wert, den sie versprechen', () => {
    const sp = erzeugeSpieler()
    const vorher = sp.schadenMult
    PASSIVE.find((p) => p.id === 'schleifstein')!.anwenden(sp)
    expect(sp.schadenMult).toBeCloseTo(vorher + 0.18)
  })

  it('halten die Abklingzeit auch voll ausgereizt ueber null', () => {
    const sp = erzeugeSpieler()
    const spule = PASSIVE.find((p) => p.id === 'zuendspule')!
    for (let i = 0; i < spule.maxStufe; i++) spule.anwenden(sp)
    expect(sp.abklingMult).toBeGreaterThan(0.3)
    expect(sp.abklingMult).toBeLessThan(1)
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
