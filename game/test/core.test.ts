import { describe, expect, it } from 'vitest'
import { Pool } from '../src/core/pool'
import { Rng, tagesSaat } from '../src/core/rng'
import { RaumGitter } from '../src/core/spatialHash'

describe('Rng', () => {
  it('liefert bei gleichem Saatwert dieselbe Folge', () => {
    const a = new Rng(12345)
    const b = new Rng(12345)
    const folgeA = Array.from({ length: 200 }, () => a.next())
    const folgeB = Array.from({ length: 200 }, () => b.next())
    expect(folgeA).toEqual(folgeB)
  })

  it('liefert bei verschiedenen Saatwerten verschiedene Folgen', () => {
    const a = new Rng(1)
    const b = new Rng(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('bleibt in [0, 1)', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 5000; i++) {
      const w = rng.next()
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThan(1)
    }
  })

  it('behandelt negative Saatwerte wie ihre vorzeichenlose Entsprechung', () => {
    // Ohne das `>>> 0` im Konstruktor liefe -1 auf eine andere Folge hinaus
    // als 0xffffffff - ein Fehler, der erst auffiele, wenn jemand einen
    // Saatwert aus einer Subtraktion bildet.
    expect(new Rng(-1).next()).toBe(new Rng(0xffffffff).next())
  })

  it('int bleibt innerhalb der Grenze', () => {
    const rng = new Rng(99)
    for (let i = 0; i < 2000; i++) {
      const w = rng.int(7)
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThan(7)
    }
  })

  it('fork ergibt einen anderen Strom als das Original', () => {
    const rng = new Rng(4242)
    const zweig = rng.fork()
    const a = Array.from({ length: 50 }, () => rng.next())
    const b = Array.from({ length: 50 }, () => zweig.next())
    expect(a).not.toEqual(b)
  })

  it('tagesSaat ist pro Tag stabil und wechselt taeglich', () => {
    const heute = new Date(Date.UTC(2026, 7, 18))
    const nochmal = new Date(Date.UTC(2026, 7, 18, 23, 59))
    const morgen = new Date(Date.UTC(2026, 7, 19))
    expect(tagesSaat(heute)).toBe(tagesSaat(nochmal))
    expect(tagesSaat(heute)).not.toBe(tagesSaat(morgen))
  })
})

describe('Pool', () => {
  it('gibt Objekte wieder aus, statt neue anzulegen', () => {
    let gebaut = 0
    const pool = new Pool(() => ({ wert: gebaut++ }), 0)
    const a = pool.nimm()
    pool.freigeben(0)
    const b = pool.nimm()
    expect(b).toBe(a)
    expect(gebaut).toBe(1)
  })

  it('haelt die Aktiv-Liste dicht', () => {
    const pool = new Pool(() => ({ wert: 0 }), 4)
    for (let i = 0; i < 5; i++) pool.nimm().wert = i
    pool.freigeben(1)
    expect(pool.anzahl).toBe(4)
    expect(pool.aktiv.every((o) => o !== undefined)).toBe(true)
  })

  it('ueberspringt beim Rueckwaertslaufen nichts', () => {
    // Das ist der Grund, warum überall rueckwaerts iteriert wird: Vorwaerts
    // wuerde das nachgerueckte letzte Element uebersprungen. Der Test haelt
    // die Regel fest, damit sie nicht irgendwann still gebrochen wird.
    const pool = new Pool(() => ({ wert: 0 }), 0)
    for (let i = 0; i < 10; i++) pool.nimm().wert = i
    const gesehen: number[] = []
    for (let i = pool.aktiv.length - 1; i >= 0; i--) {
      gesehen.push(pool.aktiv[i].wert)
      if (pool.aktiv[i].wert % 2 === 0) pool.freigeben(i)
    }
    expect(gesehen.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(pool.aktiv.map((o) => o.wert).sort((a, b) => a - b)).toEqual([1, 3, 5, 7, 9])
  })

  it('gibt bei alleFreigeben alles zurueck', () => {
    const pool = new Pool(() => ({ wert: 0 }), 0)
    for (let i = 0; i < 6; i++) pool.nimm()
    pool.alleFreigeben()
    expect(pool.anzahl).toBe(0)
  })
})

describe('RaumGitter', () => {
  it('findet, was im Umkreis liegt', () => {
    const gitter = new RaumGitter(50)
    gitter.einfuegen(0, 0, 1)
    gitter.einfuegen(30, 30, 2)
    gitter.einfuegen(900, 900, 3)
    const treffer = gitter.abfragen(0, 0, 60, [])
    expect(treffer).toContain(1)
    expect(treffer).toContain(2)
    expect(treffer).not.toContain(3)
  })

  it('funktioniert bei negativen Koordinaten', () => {
    // Die Welt ist unbegrenzt, der Spieler laeuft garantiert ins Negative.
    const gitter = new RaumGitter(50)
    gitter.einfuegen(-400, -300, 7)
    expect(gitter.abfragen(-400, -300, 20, [])).toContain(7)
  })

  it('vergisst nach dem Leeren alles', () => {
    const gitter = new RaumGitter(50)
    gitter.einfuegen(10, 10, 1)
    gitter.leeren()
    expect(gitter.abfragen(10, 10, 40, [])).toHaveLength(0)
  })

  it('verwendet das uebergebene Array wieder', () => {
    const gitter = new RaumGitter(50)
    gitter.einfuegen(0, 0, 1)
    const aus: number[] = [99, 98, 97]
    const ergebnis = gitter.abfragen(0, 0, 30, aus)
    expect(ergebnis).toBe(aus)
    expect(aus).toEqual([1])
  })
})
