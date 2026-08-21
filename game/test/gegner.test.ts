import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { GEGNER_VERHALTEN, KITT_RADIUS, STURM_TELEGRAF } from '../src/game/gegnerVerhalten'
import type { Bewegung } from '../src/game/gegnerVerhalten'
import { rissSetzen } from '../src/game/risse'
import { legeGegner } from '../src/game/spawner'
import type { GegnerArt } from '../src/game/enemies'
import type { Gegner, Spielstand } from '../src/game/state'
import { erzeugeSpielstand, gitterAufbauen, leereBefehle, starteLauf, tick } from '../src/game/state'
import { verletzeGegner } from '../src/game/welt'

/**
 * Gegner mit eigenem Kopf.
 *
 * Der Anlass war Hakans Satz "alles ist irgendwie gleich" - und er hatte
 * woertlich recht: Drei Arten, ein Verhalten, alle liefen durch dieselben acht
 * Zeilen. Diese Datei haelt fest, dass das nicht zurueckfaellt.
 */

function leeresFeld(saat = 5): Spielstand {
  const s = erzeugeSpielstand(saat)
  starteLauf(s, saat)
  s.gegner.alleFreigeben()
  gitterAufbauen(s)
  return s
}

function artMit(id: string): GegnerArt {
  const a = GEGNER_ARTEN.find((x) => x.id === id)
  if (a === undefined) throw new Error(`Art ${id} fehlt`)
  return a
}

function setze(s: Spielstand, id: string, x: number, y: number): Gegner {
  const g = legeGegner(s, artMit(id), x, y)
  if (g === null) throw new Error('kein Platz im Pool')
  return g
}

const wunsch: Bewegung = { vx: 0, vy: 0 }

function bewege(s: Spielstand, g: Gegner, dt = TICK_DT): Bewegung {
  GEGNER_VERHALTEN[g.art.verhalten].bewege(s, g, dt, wunsch)
  return wunsch
}

describe('Die Arten sind wirklich verschieden', () => {
  it('benutzt mindestens sechs verschiedene Verhalten', () => {
    const verhalten = new Set(GEGNER_ARTEN.map((a) => a.verhalten))
    expect(verhalten.size).toBeGreaterThanOrEqual(6)
  })

  it('laesst hoechstens drei Arten dasselbe Muster teilen', () => {
    // Eine Grundmasse aus schlichten Jaegern ist richtig - aber sie darf nicht
    // wieder die Mehrheit stellen. Genau daran lag es vorher.
    // Gezaehlt werden nur Arten, die der Spawner ueberhaupt zieht: Das
    // Bruchstueck entsteht allein beim Zerfall eines Teilers und sagt nichts
    // darueber, wie abwechslungsreich sich eine Welle anfuehlt.
    const zaehler = new Map<string, number>()
    for (const a of GEGNER_ARTEN) {
      if (a.gewicht <= 0) continue
      zaehler.set(a.verhalten, (zaehler.get(a.verhalten) ?? 0) + 1)
    }
    for (const [id, anzahl] of zaehler) expect(anzahl, id).toBeLessThanOrEqual(3)
  })

  it('gibt jeder Art ihre eigene Silhouette', () => {
    // Zwei gleich geformte Arten sind im Pulk keine zwei Arten mehr.
    const formen = GEGNER_ARTEN.filter((a) => a.gewicht > 0).map((a) => a.form)
    expect(new Set(formen).size).toBe(formen.length)
  })
})

describe('Der Kitt', () => {
  it('schliesst die Risse der Umstehenden', () => {
    const s = leeresFeld()
    const opfer = setze(s, 'splitter', 40, 0)
    rissSetzen(opfer, 0)
    rissSetzen(opfer, 1)
    expect(opfer.risse).toBe(2)

    const kitt = setze(s, 'kitt', 0, 0)
    gitterAufbauen(s)
    // Der Takt laeuft ab, danach wirkt er.
    kitt.takt = 0
    bewege(s, kitt)
    expect(opfer.risse).toBe(0)
  })

  it('laesst seine eigenen Risse stehen', () => {
    // Sonst waere die Gegenwehr - ihn zuerst wegzumachen - ausgerechnet an ihm
    // am schwersten.
    const s = leeresFeld()
    const kitt = setze(s, 'kitt', 0, 0)
    rissSetzen(kitt, 0)
    rissSetzen(kitt, 1)
    gitterAufbauen(s)
    kitt.takt = 0
    bewege(s, kitt)
    expect(kitt.risse).toBe(2)
  })

  it('reicht nicht weiter, als sein Ring zeigt', () => {
    const s = leeresFeld()
    const fern = setze(s, 'splitter', KITT_RADIUS * 2.5, 0)
    rissSetzen(fern, 0)
    const kitt = setze(s, 'kitt', 0, 0)
    gitterAufbauen(s)
    kitt.takt = 0
    bewege(s, kitt)
    expect(fern.risse).toBe(1)
  })
})

describe('Der Stürmer', () => {
  it('prescht nie ohne Vorwarnung', () => {
    const s = leeresFeld()
    s.spieler.x = 0
    s.spieler.y = 0
    const g = setze(s, 'stuermer', 200, 0)

    // Erster Tick in Reichweite: kuendigt an und steht still.
    bewege(s, g)
    expect(g.zustand).toBe(1)
    expect(g.takt).toBeCloseTo(STURM_TELEGRAF, 3)

    const stand = bewege(s, g)
    expect(stand.vx).toBe(0)
    expect(stand.vy).toBe(0)

    // Erst nach Ablauf der Vorwarnung geht es los.
    let ticks = 0
    while (g.zustand === 1 && ticks < 200) {
      bewege(s, g)
      ticks++
    }
    expect(g.zustand).toBe(2)
    expect(ticks * TICK_DT).toBeGreaterThan(STURM_TELEGRAF * 0.8)
  })

  it('haelt die angekuendigte Bahn, statt nachzuziehen', () => {
    // Ein Sturm, der mitlenkt, laesst sich nicht ausweichen - dann waere die
    // Vorwarnung eine Luege.
    const s = leeresFeld()
    const g = setze(s, 'stuermer', 200, 0)
    bewege(s, g)
    while (g.zustand === 1) bewege(s, g)

    // Der Tick, in dem der Sturm *anspringt*, liefert noch die Null der
    // Vorwarnung - erst der naechste faehrt die Bahn. Also einmal weiter.
    bewege(s, g)
    const erste = { vx: wunsch.vx, vy: wunsch.vy }
    expect(Math.hypot(erste.vx, erste.vy)).toBeGreaterThan(0)

    s.spieler.x = 900
    s.spieler.y = 900
    const zweite = bewege(s, g)
    expect(zweite.vx).toBeCloseTo(erste.vx, 5)
    expect(zweite.vy).toBeCloseTo(erste.vy, 5)
  })
})

describe('Der Speier', () => {
  it('schiesst aus der Ferne und benutzt den Feindpool', () => {
    const s = leeresFeld()
    s.spieler.x = 0
    s.spieler.y = 0
    const g = setze(s, 'speier', 340, 0)
    g.takt = 0

    expect(s.feindSchuesse.anzahl).toBe(0)
    bewege(s, g)
    expect(s.feindSchuesse.anzahl).toBe(1)
    // Und er laedt nach, statt jeden Tick zu feuern.
    bewege(s, g)
    expect(s.feindSchuesse.anzahl).toBe(1)
  })

  it('haelt Abstand, statt anzurennen', () => {
    const s = leeresFeld()
    s.spieler.x = 0
    s.spieler.y = 0
    const g = setze(s, 'speier', 90, 0)
    const b = bewege(s, g)
    // Zu nah: Er weicht zurueck, laeuft also von der Null weg.
    expect(b.vx).toBeGreaterThan(0)
  })
})

describe('Der Teiler', () => {
  it('hinterlaesst genau zwei Bruchstuecke, die sich nicht weiter teilen', () => {
    const s = leeresFeld()
    const g = setze(s, 'teiler', 0, 0)
    expect(s.gegner.anzahl).toBe(1)

    GEGNER_VERHALTEN[g.art.verhalten].beiTod?.(s, g)
    expect(s.gegner.anzahl).toBe(3)

    const kinder = s.gegner.aktiv.filter((x) => x !== g)
    expect(kinder.length).toBe(2)
    for (const k of kinder) {
      expect(k.art.id).toBe('teilerklein')
      // Das Bruchstueck traegt bewusst *nicht* das Teiler-Verhalten - sonst
      // waere ein Teiler eine Lawine ohne Ende.
      expect(GEGNER_VERHALTEN[k.art.verhalten].beiTod).toBeUndefined()
    }
  })

  it('haelt das Bruchstueck aus dem Spawner heraus', () => {
    expect(artMit('teilerklein').gewicht).toBe(0)
  })
})

describe('Der Schildträger', () => {
  it('nimmt von vorn deutlich weniger Schaden als von hinten', () => {
    const s = leeresFeld()
    s.spieler.x = 300
    s.spieler.y = 0

    const vorn = setze(s, 'schild', 0, 0)
    vorn.blick = 0 // schaut nach +x, also zum Spieler
    const vorherVorn = vorn.hp
    verletzeGegner(s, vorn, 100, 0, false, 0, 0)
    const schadenVorn = vorherVorn - vorn.hp

    const hinten = setze(s, 'schild', 0, 0)
    hinten.blick = Math.PI // schaut weg
    const vorherHinten = hinten.hp
    verletzeGegner(s, hinten, 100, 0, false, 0, 0)
    const schadenHinten = vorherHinten - hinten.hp

    expect(schadenVorn).toBeLessThan(schadenHinten * 0.4)
  })

  it('dreht sich nur begrenzt schnell mit', () => {
    // Sonst schaute er immer zum Spieler, und Umlaufen waere sinnlos.
    const s = leeresFeld()
    s.spieler.x = 0
    s.spieler.y = 0
    const g = setze(s, 'schild', 100, 0)
    g.blick = 0 // schaut vom Spieler weg
    bewege(s, g, TICK_DT)
    expect(Math.abs(g.blick)).toBeLessThan(0.1)
  })
})

describe('Der Schwärmer', () => {
  it('laeuft nicht geradeaus auf den Spieler zu', () => {
    const s = leeresFeld()
    s.spieler.x = 0
    s.spieler.y = 0
    const g = setze(s, 'schwaermer', 250, 0)
    const b = bewege(s, g)
    // Auf Wunschabstand ist die Bewegung fast reine Seitwaertsbewegung.
    expect(Math.abs(b.vy)).toBeGreaterThan(Math.abs(b.vx))
  })
})

describe('Wiederverwendete Gegner', () => {
  it('kommen ohne die Risse ihres Vorgaengers zur Welt', () => {
    /*
     * Der Fehler, gegen den dieser Test steht: Der Pool gibt gebrauchte
     * Objekte heraus, und `legeGegner` hat die Riss-Felder nie geleert. Ein
     * frischer Gegner erbte die Risse seines Vorgaengers - mal kam er mit zwei
     * Rissen zur Welt, mal trug er dessen `zersplittert` und konnte nie wieder
     * zerspringen. Die Kernregel war damit teilweise ein Wuerfelwurf.
     */
    const s = leeresFeld()
    const erster = setze(s, 'splitter', 0, 0)
    rissSetzen(erster, 0)
    rissSetzen(erster, 1)
    rissSetzen(erster, 2)
    erster.zersplittert = true
    erster.takt = 9
    erster.zustand = 2
    erster.blick = 3
    s.gegner.alleFreigeben()

    const zweiter = setze(s, 'splitter', 0, 0)
    expect(zweiter.risse).toBe(0)
    expect(zweiter.risseMaske).toBe(0)
    expect(zweiter.zersplittert).toBe(false)
    expect(zweiter.takt).toBe(0)
    expect(zweiter.zustand).toBe(0)
    expect(zweiter.blick).toBe(0)
  })
})

describe('Ein ganzer Lauf mit allen Arten', () => {
  it('laeuft durch, ohne dass etwas entgleist', () => {
    const s = erzeugeSpielstand(21)
    starteLauf(s, 21)
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
    const b = leereBefehle()
    b.wahl = 0

    // Weit genug, dass jede Art einmal auftaucht - der Schildtraeger ab 5:00.
    for (let i = 0; i < 60 * 340; i++) {
      b.x = Math.cos(i * 0.011)
      b.y = Math.sin(i * 0.011)
      tick(s, b, TICK_DT)
    }

    const gesehen = new Set(s.gegner.aktiv.map((g) => g.art.id))
    expect(gesehen.size).toBeGreaterThan(4)
    expect(s.statistik.kills).toBeGreaterThan(0)
  })
})
