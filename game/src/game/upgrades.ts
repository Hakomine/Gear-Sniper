import type { Rng } from '../core/rng'
import { heileSpieler } from './player'
import type { Spieler } from './state'

/**
 * Aufwertungen als Daten.
 *
 * Jede wirkt ausschliesslich ueber die Multiplikatoren am Spieler - keine
 * Sonderfaelle, keine Abfragen irgendwo sonst im Code. Deshalb ist eine neue
 * Aufwertung ein Eintrag in dieser Liste und sonst nichts, und deshalb
 * koennen beliebige Kombinationen miteinander wirken, ohne dass jemand sie
 * einzeln vorgesehen haben muss.
 */
export type Aufwertung = {
  readonly id: string
  readonly name: string
  readonly beschreibung: string
  /** Wie oft sie hoechstens genommen werden kann. */
  readonly maxStufe: number
  readonly anwenden: (sp: Spieler) => void
  /** Zusaetzliche Bedingung - z. B. Heilung nur bei Schaden anbieten. */
  readonly verfuegbar?: (sp: Spieler) => boolean
}

export const AUFWERTUNGEN: readonly Aufwertung[] = [
  {
    id: 'wucht',
    name: 'Wucht',
    beschreibung: '+25 % Schaden',
    maxStufe: 6,
    anwenden: (sp) => {
      sp.schadenMult += 0.25
    },
  },
  {
    id: 'taktung',
    name: 'Taktung',
    beschreibung: '−11 % Abklingzeit',
    maxStufe: 6,
    anwenden: (sp) => {
      // Multiplikativ, nicht additiv: Additiv waere die sechste Stufe bei
      // −66 % und die Waffe kaeme dem Nullpunkt gefaehrlich nahe.
      sp.abklingMult *= 0.89
    },
  },
  {
    id: 'faecher',
    name: 'Fächer',
    beschreibung: '+1 Geschoss pro Schuss',
    maxStufe: 3,
    anwenden: (sp) => {
      sp.zusatzProjektile += 1
    },
  },
  {
    id: 'durchschlag',
    name: 'Durchschlag',
    beschreibung: '+1 durchschlagener Gegner',
    maxStufe: 3,
    anwenden: (sp) => {
      sp.zusatzDurchschlag += 1
    },
  },
  {
    id: 'laufwerk',
    name: 'Laufwerk',
    beschreibung: '+9 % Lauftempo',
    maxStufe: 5,
    anwenden: (sp) => {
      sp.tempoMult += 0.09
    },
  },
  {
    id: 'panzerung',
    name: 'Panzerung',
    beschreibung: '+22 max. Leben, heilt 22',
    maxStufe: 6,
    anwenden: (sp) => {
      sp.maxHp += 22
      heileSpieler(sp, 22)
    },
  },
  {
    id: 'magnetfeld',
    name: 'Magnetfeld',
    beschreibung: '+42 % Einzugsradius',
    maxStufe: 4,
    anwenden: (sp) => {
      sp.magnetRadius *= 1.42
    },
  },
  {
    id: 'schwung',
    name: 'Schwung',
    beschreibung: '+18 % Geschosstempo',
    maxStufe: 4,
    anwenden: (sp) => {
      sp.geschossTempoMult += 0.18
    },
  },
  {
    id: 'praezision',
    name: 'Präzision',
    beschreibung: '+7 % kritische Trefferchance',
    maxStufe: 5,
    anwenden: (sp) => {
      sp.kritChance += 0.07
    },
  },
  {
    id: 'reparatur',
    name: 'Reparatur',
    beschreibung: 'Heilt 35 % des Lebens',
    // Unbegrenzt, damit die Auswahl nie leer bleibt, wenn spaet im Lauf alles
    // andere ausgereizt ist.
    maxStufe: Infinity,
    anwenden: (sp) => {
      heileSpieler(sp, sp.maxHp * 0.35)
    },
    // Nur anbieten, wenn sie etwas bringt. Eine Heilung bei vollem Leben ist
    // eine verschenkte Wahl - und verschenkte Wahlen sind das, was ein
    // Levelup-Menue langweilig macht.
    verfuegbar: (sp) => sp.hp < sp.maxHp * 0.92,
  },
]

/**
 * `anzahl` verschiedene Angebote ziehen.
 *
 * Ausgereizte und gerade unpassende Aufwertungen fallen weg. Wenn danach zu
 * wenige uebrig sind, gibt es eben weniger Karten - lieber zwei sinnvolle als
 * drei mit einer Blindkarte.
 */
export function zieheAngebote(
  rng: Rng,
  stufen: Map<string, number>,
  sp: Spieler,
  anzahl: number,
): Aufwertung[] {
  const moeglich = AUFWERTUNGEN.filter((a) => {
    if ((stufen.get(a.id) ?? 0) >= a.maxStufe) return false
    if (a.verfuegbar && !a.verfuegbar(sp)) return false
    return true
  })

  // Teilweises Fisher-Yates: zieht ohne Zuruecklegen, also ohne Dubletten,
  // und kopiert die Liste nur einmal.
  const ziehung = moeglich.slice()
  const ergebnis: Aufwertung[] = []
  const wieViele = Math.min(anzahl, ziehung.length)

  for (let i = 0; i < wieViele; i++) {
    const j = i + rng.int(ziehung.length - i)
    const tausch = ziehung[i]
    ziehung[i] = ziehung[j]
    ziehung[j] = tausch
    ergebnis.push(ziehung[i])
  }
  return ergebnis
}
