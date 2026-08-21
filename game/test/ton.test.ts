import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { Klangpuffer } from '../src/game/klaenge'
import { legeGegner } from '../src/game/spawner'
import { erzeugeSpielstand, gitterAufbauen, leereBefehle, starteLauf, tick } from '../src/game/state'
import { arbeiteKaskadeAb, verletzeGegner } from '../src/game/welt'

/**
 * Ton - und die Grenze, die ihn moeglich macht.
 *
 * Der wichtigste Test hier ist der erste: `src/game/` darf keinen Browser
 * kennen. Darauf beruhen alle Tests dieser Suite und `npm run perf`. Ein
 * `AudioContext` in `state.ts` waere bequem und wuerde beides auf einen Schlag
 * unbrauchbar machen - deshalb steht die Regel als Test da und nicht als
 * Absichtserklaerung im README.
 */

/** Kommentare entfernen, damit Prosa ueber den Browser nicht als Code zaehlt. */
function ohneKommentare(quelltext: string): string {
  return quelltext.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

function dateienIn(ordner: string): string[] {
  const treffer: string[] = []
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name)
    if (eintrag.isDirectory()) treffer.push(...dateienIn(pfad))
    else if (eintrag.name.endsWith('.ts')) treffer.push(pfad)
  }
  return treffer
}

describe('Die Simulation kennt keinen Browser', () => {
  it('benutzt in src/game/ weder AudioContext noch window, document oder navigator', () => {
    const verboten = [/\bAudioContext\b/, /\bwindow\./, /\bdocument\./, /\bnavigator\./]
    for (const pfad of dateienIn('src/game')) {
      const code = ohneKommentare(readFileSync(pfad, 'utf8'))
      for (const muster of verboten) {
        expect(muster.test(code), `${pfad} greift auf ${muster.source} zu`).toBe(false)
      }
    }
  })

  it('haelt den Ton selbst ausserhalb davon', () => {
    // Umgekehrte Probe: Der Synthesizer *muss* dort liegen, wo er den Browser
    // kennen darf. Steht er in src/game/, ist der Test oben umgangen worden.
    const dateien = dateienIn('src/audio')
    expect(dateien.length).toBeGreaterThan(0)
    expect(readFileSync('src/audio/ton.ts', 'utf8')).toContain('AudioContext')
  })
})

describe('Der Klangpuffer', () => {
  it('meldet und zaehlt', () => {
    const p = new Klangpuffer()
    p.melde('riss')
    p.melde('riss')
    p.melde('zersplittert', 1.4)
    expect(p.laenge).toBe(3)
    expect(p.zaehle('riss')).toBe(2)
    expect(p.lies(2).staerke).toBeCloseTo(1.4)
  })

  it('waechst nicht ueber seinen Deckel, sondern verwirft', () => {
    // Bei 1400 Gegnern und fuenf Waffen fallen in einem Tick mehrere hundert
    // Treffer an. Ein mitwachsendes Array waere genau die Sorte Muell, die die
    // Pools im ganzen Spiel vermeiden.
    const p = new Klangpuffer()
    for (let i = 0; i < 5000; i++) p.melde('treffer')
    expect(p.laenge).toBeLessThanOrEqual(256)
    expect(p.verworfen).toBeGreaterThan(0)
  })

  it('ist nach dem Leeren wieder leer', () => {
    const p = new Klangpuffer()
    p.melde('stufe')
    p.leeren()
    expect(p.laenge).toBe(0)
    expect(p.verworfen).toBe(0)
  })
})

describe('Was die Simulation meldet', () => {
  it('meldet einen Riss nur, wenn wirklich einer dazukommt', () => {
    const s = erzeugeSpielstand(3)
    starteLauf(s, 3)
    s.gegner.alleFreigeben()
    gitterAufbauen(s)
    const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
    if (g === null) throw new Error('kein Gegner')
    g.hp = 1e6
    g.maxHp = 1e6
    s.klaenge.leeren()

    verletzeGegner(s, g, 1, 0, false, 0, 0)
    expect(s.klaenge.zaehle('riss')).toBe(1)

    // Dieselbe Waffe noch dreimal: kein neuer Riss, also auch kein Klang.
    verletzeGegner(s, g, 1, 0, false, 0, 0)
    verletzeGegner(s, g, 1, 0, false, 0, 0)
    expect(s.klaenge.zaehle('riss')).toBe(1)
    // Getroffen wurde er trotzdem dreimal.
    expect(s.klaenge.zaehle('treffer')).toBe(3)
  })

  it('meldet die Zersplitterung genau einmal je Ereignis', () => {
    const s = erzeugeSpielstand(3)
    starteLauf(s, 3)
    s.gegner.alleFreigeben()
    gitterAufbauen(s)
    const g = legeGegner(s, GEGNER_ARTEN[0], 0, 0)
    if (g === null) throw new Error('kein Gegner')
    g.hp = 1e6
    g.maxHp = 1e6
    s.klaenge.leeren()

    for (let platz = 0; platz < 3; platz++) verletzeGegner(s, g, 1, platz, false, 0, 0)
    arbeiteKaskadeAb(s)
    expect(s.klaenge.zaehle('zersplittert')).toBe(1)
  })

  it('meldet den Tod des Spielers', () => {
    const s = erzeugeSpielstand(3)
    starteLauf(s, 3)
    s.klaenge.leeren()
    s.spieler.hp = 0
    tick(s, leereBefehle(), TICK_DT)
    expect(s.phase).toBe('tot')
    expect(s.klaenge.zaehle('zerbrochen')).toBe(1)
  })

  it('faengt jeden Lauf mit leerem Puffer an', () => {
    const s = erzeugeSpielstand(3)
    starteLauf(s, 3)
    s.klaenge.melde('boss')
    starteLauf(s, 3)
    expect(s.klaenge.laenge).toBe(0)
  })
})
