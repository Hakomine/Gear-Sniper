import { FUSIONEN, istFusion } from './fusionen'
import { heileSpieler } from './player'
import type { Spieler, Spielstand } from './state'
import type { Seltenheit, WaffenDef } from './weapons'
import {
  freierPlatz,
  istVollendet,
  ruesteAus,
  SELTENHEIT_GEWICHT,
  stufenText,
  WAFFEN,
  werteAuf,
} from './weapons'

/**
 * Was auf den Levelup-Karten steht.
 *
 * Vorher waren das ausschliesslich Zahlenschieber - "+25 % Schaden",
 * "−11 % Abklingzeit". Wer nach dem dritten Levelup schon weiss, was kommt,
 * hoert auf zu spielen. Jetzt ziehen die Karten aus drei Toepfen:
 *
 *   1. eine neue Waffe (nur solange ein Platz frei ist)
 *   2. eine getragene Waffe aufwerten
 *   3. ein passiver Gegenstand
 *
 * Die Gewichte sorgen dafuer, dass Waffen die Karten beherrschen und die
 * passiven Werte das sind, was sie sein sollen: Kitt fuer einen Bau, nicht
 * der Bau.
 */
export type AufwertungArt = 'waffe' | 'stufe' | 'passiv' | 'fusion'

export type Aufwertung = {
  readonly id: string
  readonly art: AufwertungArt
  readonly name: string
  readonly beschreibung: string
  readonly seltenheit: Seltenheit
  readonly farbe: string
  /** Nur bei 'stufe' gesetzt - fuer die Anzeige "Stufe 2 → 3". */
  readonly stufeVon?: number
  readonly stufeNach?: number
  /** Nur bei 'stufe': Dieser Schritt ist die Vollendung. */
  readonly vollendung?: boolean
  /** Fuer die Stufenpunkte auf der Karte. Unendlich wird nicht gezeigt. */
  readonly maxStufe?: number
  readonly anwenden: (s: Spielstand) => void
}

// ---------------------------------------------------------------------------
// Passive Gegenstaende
// ---------------------------------------------------------------------------

type PassivDef = {
  readonly id: string
  readonly name: string
  readonly beschreibung: string
  readonly seltenheit: Seltenheit
  readonly maxStufe: number
  readonly anwenden: (sp: Spieler) => void
  readonly verfuegbar?: (sp: Spieler) => boolean
}

/**
 * Bewusst Gegenstaende mit Namen statt nackter Werte.
 *
 * "Schleifstein" ist dieselbe Zahl wie "+18 % Schaden" und trotzdem eine
 * andere Karte: Man merkt sich Dinge, keine Prozentsaetze.
 */
/**
 * Gegenstände, die Regeln ändern - nicht Zahlen.
 *
 * Vorher standen hier sieben Prozentwerte: "+18 % Schaden", "+7 % Krit". Das
 * ist genau der Vorwurf, den Hakan in Runde zwei den *Waffen* gemacht hat -
 * bei den Passiven stand er noch. Ein Gegenstand, der aendert, *wie* etwas
 * funktioniert, ist eine Entscheidung; einer, der eine Zahl erhoeht, ist
 * Buchhaltung.
 *
 * Drei Wertegegenstaende bleiben als Kitt: Leben, Tempo und eine Heilung
 * braucht ein Bau, und nicht jede Karte darf eine Grundsatzfrage sein.
 *
 * Fast alle haengen an der Kernregel - Risse und Zersplitterung. Das ist
 * Absicht: Ein Gegenstand, der den eigenen Bau umbaut, ist mehr wert als
 * einer, der irgendein Nebensystem verbessert.
 */
export const PASSIVE: readonly PassivDef[] = [
  // --- Der Kitt: drei ehrliche Werte ---------------------------------------
  {
    id: 'panzerplatte',
    name: 'Panzerplatte',
    beschreibung: '+25 max. Leben, heilt 25',
    seltenheit: 'gewoehnlich',
    maxStufe: 6,
    anwenden: (sp) => {
      sp.maxHp += 25
      heileSpieler(sp, 25)
    },
  },
  {
    id: 'laufsohlen',
    name: 'Laufsohlen',
    beschreibung: '+9 % Lauftempo',
    seltenheit: 'gewoehnlich',
    maxStufe: 5,
    anwenden: (sp) => {
      sp.tempoMult += 0.09
    },
  },
  {
    id: 'notpflaster',
    name: 'Notpflaster',
    beschreibung: 'Heilt 35 % des Lebens',
    seltenheit: 'gewoehnlich',
    // Unbegrenzt, damit die Auswahl nie leer bleibt, wenn spaet im Lauf alles
    // andere ausgereizt ist.
    maxStufe: Infinity,
    anwenden: (sp) => {
      heileSpieler(sp, sp.maxHp * 0.35)
    },
    // Nur anbieten, wenn sie etwas bringt. Eine Heilung bei vollem Leben ist
    // eine verschenkte Wahl - und verschenkte Wahlen machen ein Menue oede.
    verfuegbar: (sp) => sp.hp < sp.maxHp * 0.92,
  },

  // --- Zwölf, die Regeln ändern --------------------------------------------
  {
    id: 'nachhall',
    name: 'Nachhall',
    beschreibung: 'Risse halten eine Sekunde länger',
    seltenheit: 'gewoehnlich',
    maxStufe: 3,
    anwenden: (sp) => {
      // Der zugaenglichste der zwoelf: Er macht die Kernregel leichter zu
      // treffen, ohne ihr etwas wegzunehmen.
      sp.rissDauer += 1
    },
  },
  {
    id: 'kettenriss',
    name: 'Kettenriss',
    beschreibung: 'Jeder dritte Riss springt auf einen zweiten Gegner über',
    seltenheit: 'selten',
    maxStufe: 2,
    anwenden: (sp) => {
      // Stufe zwei macht daraus "jeder zweite".
      sp.kettenRiss = sp.kettenRiss === 0 ? 3 : 2
    },
  },
  {
    id: 'splitterfeld',
    name: 'Splitterfeld',
    beschreibung: 'Zersplitterte hinterlassen drei Sekunden lang scharfe Scherben',
    seltenheit: 'selten',
    maxStufe: 3,
    anwenden: (sp) => {
      sp.splitterFeld += 3
    },
  },
  {
    id: 'blutglas',
    name: 'Blutglas',
    beschreibung: 'Jede Zersplitterung heilt dich um 1',
    seltenheit: 'selten',
    maxStufe: 4,
    anwenden: (sp) => {
      // Klingt nach wenig und ist es auch - bis der Bau zersplittert. Genau
      // deshalb belohnt es die Kernregel statt rohen Schaden.
      sp.blutglas += 1
    },
  },
  {
    id: 'fehlschlag',
    name: 'Fehlschlag',
    beschreibung: 'Kritische Treffer setzen einen zusätzlichen Riss',
    seltenheit: 'episch',
    maxStufe: 1,
    anwenden: (sp) => {
      sp.kritRiss = true
    },
  },
  {
    id: 'zwillingsbruch',
    name: 'Zwillingsbruch',
    beschreibung: 'Zersplitterung trifft doppelt so weit, aber halb so hart',
    seltenheit: 'episch',
    maxStufe: 1,
    anwenden: (sp) => {
      sp.zwillingsbruch = 2
    },
  },
  {
    id: 'standhaft',
    name: 'Standhaft',
    beschreibung: 'Zwei Sekunden stillstehen lädt einen Schild, der einen Treffer schluckt',
    seltenheit: 'selten',
    maxStufe: 2,
    anwenden: (sp) => {
      sp.standhaft = sp.standhaft === 0 ? 2 : 1.2
    },
  },
  {
    id: 'aussetzer',
    name: 'Aussetzer',
    beschreibung: 'Wirst du getroffen, zersplittert alles im Umkreis',
    seltenheit: 'episch',
    maxStufe: 1,
    anwenden: (sp) => {
      // Macht aus einem Fehler eine Chance - aber nur, wenn ringsum genug
      // steht. Wer sauber spielt, sieht es nie.
      sp.aussetzer = true
    },
  },
  {
    id: 'nachstoss',
    name: 'Nachstoß',
    beschreibung: 'Der Stoß lädt doppelt so schnell',
    seltenheit: 'selten',
    maxStufe: 2,
    anwenden: (sp) => {
      sp.stossLaden += 1
    },
  },
  {
    id: 'sog',
    name: 'Sog',
    beschreibung: 'Kristalle kommen zu dir, solange du stillstehst',
    seltenheit: 'gewoehnlich',
    maxStufe: 3,
    anwenden: (sp) => {
      // Passt zum Amboss und zu Standhaft: Wer ohnehin stehenbleiben muss,
      // bekommt einen Grund mehr dafuer.
      sp.sog += 260
    },
  },
  {
    id: 'zeitlupe',
    name: 'Zeitlupe',
    beschreibung: 'Unter 30 % Leben läuft alles andere 20 % langsamer',
    seltenheit: 'episch',
    maxStufe: 2,
    anwenden: (sp) => {
      sp.zeitlupe += 0.2
    },
  },
  {
    id: 'letzterriss',
    name: 'Letzter Riss',
    beschreibung: 'Fällt ein Boss, reißt es alles im Bild auf',
    seltenheit: 'legendaer',
    maxStufe: 1,
    anwenden: (sp) => {
      sp.letzterRiss = true
    },
  },
]


// ---------------------------------------------------------------------------
// Ziehung
// ---------------------------------------------------------------------------

/** Wie stark eine Waffenstufe gegenueber einem Fund gewichtet wird. */
const GEWICHT_STUFE = 75

/**
 * Gewicht einer moeglichen Verschmelzung.
 *
 * Hoch genug, dass man sie sieht, sobald sie moeglich ist - eine Fusion, auf
 * die man zwanzig Stufen wartet, ist keine Belohnung, sondern Zufall. Sie
 * kommt ohnehin nur zustande, wenn *zwei* Waffen ausgereizt sind, und das ist
 * die eigentliche Huerde.
 */
const GEWICHT_FUSION = 90

/**
 * Passive sind absichtlich im Hintertreffen. Ganz weglassen waere falsch -
 * ohne sie liesse sich ein schwacher Bau nicht mehr auffangen, und es gaebe
 * keine Heilung.
 */
const GEWICHT_PASSIV_ANTEIL = 0.35

type Kandidat = { gewicht: number; bauen: () => Aufwertung }

/**
 * Wie stark die Bossbelohnung die Seltenheiten verschiebt.
 *
 * Kein hartes Filtern auf "nur legendaer": Waere gerade nichts Legendaeres
 * verfuegbar, staende der Spieler vor einer leeren Auswahl. Ein kraeftiger
 * Faktor macht den guten Fund sehr wahrscheinlich und laesst die Ziehung
 * trotzdem immer etwas ausspucken.
 */
const BOSS_BONUS: Record<string, number> = {
  gewoehnlich: 1,
  selten: 3,
  episch: 9,
  legendaer: 16,
}

function waffenKandidaten(s: Spielstand): Kandidat[] {
  const sp = s.spieler
  const liste: Kandidat[] = []
  const getragen = new Set(sp.waffen.map((w) => w.def.id))
  const bonus = (seltenheit: Seltenheit): number => (s.bossKarte ? BOSS_BONUS[seltenheit] : 1)

  // Topf 1: neue Waffen - nur solange ein Platz frei ist.
  if (sp.waffen.length < sp.maxWaffen) {
    for (const def of WAFFEN) {
      if (getragen.has(def.id)) continue
      if (istFusion(def.id)) continue
      liste.push({
        gewicht: SELTENHEIT_GEWICHT[def.seltenheit] * bonus(def.seltenheit),
        bauen: () => neueWaffe(def),
      })
    }
  }

  // Topf 2: Verschmelzungen - nur wenn *beide* Eltern ausgereizt sind.
  for (const fusion of FUSIONEN) {
    // Wer die Eltern spaeter neu zieht und wieder ausreizt, darf dieselbe
    // Fusion nicht ein zweites Mal bekommen - gemessen stand danach
    // "Schwarmnadeln 4" *und* "Schwarmnadeln 1" im Guertel. Zwei Kopien
    // derselben Waffe sind kein Bau, sondern ein Anzeigefehler mit Wirkung.
    if (getragen.has(fusion.def.id)) continue
    const [aId, bId] = fusion.aus
    const a = sp.waffen.find((w) => w.def.id === aId)
    const b = sp.waffen.find((w) => w.def.id === bId)
    if (a === undefined || b === undefined) continue
    if (!istVollendet(a.def, a.stufe) || !istVollendet(b.def, b.stufe)) continue
    liste.push({ gewicht: GEWICHT_FUSION, bauen: () => fusionsKarte(fusion) })
  }

  // Topf 3: getragene Waffen aufwerten.
  for (const w of sp.waffen) {
    if (istVollendet(w.def, w.stufe)) continue
    const stufe = w.stufe
    liste.push({
      gewicht: GEWICHT_STUFE * bonus(w.def.seltenheit),
      bauen: () => waffenStufe(w.def, stufe),
    })
  }

  return liste
}

function fusionsKarte(fusion: (typeof FUSIONEN)[number]): Aufwertung {
  const def = fusion.def
  return {
    id: `fusion:${def.id}`,
    art: 'fusion',
    name: def.name,
    beschreibung: def.beschreibung,
    seltenheit: 'fusion',
    farbe: def.farbe,
    anwenden: (s) => {
      const [aId, bId] = fusion.aus
      // Beide Eltern raus, *dann* den freien Platz suchen: Die neue Waffe soll
      // den niedrigeren der beiden frei gewordenen Plaetze bekommen, damit der
      // Guertel nicht auseinanderfaellt.
      s.spieler.waffen = s.spieler.waffen.filter((w) => w.def.id !== aId && w.def.id !== bId)
      const platz = freierPlatz(s.spieler.waffen, s.spieler.maxWaffen)
      if (platz < 0) return
      s.spieler.waffen.push(ruesteAus(def, platz))
      s.statistik.platzName[platz] = def.name
      s.statistik.platzFarbe[platz] = def.farbe
    },
  }
}

function neueWaffe(def: WaffenDef): Aufwertung {
  return {
    id: `waffe:${def.id}`,
    art: 'waffe',
    name: def.name,
    beschreibung: def.beschreibung,
    seltenheit: def.seltenheit,
    farbe: def.farbe,
    anwenden: (s) => {
      // Kleinster freier Platz, nicht die Array-Laenge: Nach einer Fusion sind
      // Luecken im Guertel, und die Laenge wuerde ein bereits belegtes
      // Riss-Bit noch einmal vergeben.
      const platz = freierPlatz(s.spieler.waffen, s.spieler.maxWaffen)
      if (platz < 0) return
      s.spieler.waffen.push(ruesteAus(def, platz))
      s.statistik.platzName[platz] = def.name
      s.statistik.platzFarbe[platz] = def.farbe
    },
  }
}

function waffenStufe(def: WaffenDef, stufe: number): Aufwertung {
  const vollendung = stufe + 1 >= def.maxStufe
  return {
    id: `stufe:${def.id}`,
    art: 'stufe',
    name: def.name,
    beschreibung: stufenText(def, stufe),
    seltenheit: def.seltenheit,
    farbe: def.farbe,
    stufeVon: stufe,
    stufeNach: stufe + 1,
    vollendung,
    maxStufe: def.maxStufe,
    anwenden: (s) => {
      const w = s.spieler.waffen.find((x) => x.def.id === def.id)
      if (w !== undefined) werteAuf(w)
    },
  }
}

function passivKandidaten(s: Spielstand): Kandidat[] {
  const sp = s.spieler
  const liste: Kandidat[] = []

  for (const def of PASSIVE) {
    if ((s.stufen.get(def.id) ?? 0) >= def.maxStufe) continue
    if (def.verfuegbar && !def.verfuegbar(sp)) continue
    liste.push({
      gewicht: SELTENHEIT_GEWICHT[def.seltenheit] * GEWICHT_PASSIV_ANTEIL * (s.bossKarte ? 0.15 : 1),
      bauen: () => ({
        id: `passiv:${def.id}`,
        art: 'passiv' as const,
        name: def.name,
        beschreibung: def.beschreibung,
        seltenheit: def.seltenheit,
        farbe: '#8d99b3',
        maxStufe: def.maxStufe,
        stufeVon: s.stufen.get(def.id) ?? 0,
        anwenden: (st: Spielstand) => {
          def.anwenden(st.spieler)
          st.stufen.set(def.id, (st.stufen.get(def.id) ?? 0) + 1)
        },
      }),
    })
  }
  return liste
}

/** Einen Kandidaten nach Gewicht ziehen und aus der Liste entfernen. */
function ziehe(s: Spielstand, liste: Kandidat[]): Aufwertung | null {
  if (liste.length === 0) return null
  let summe = 0
  for (const k of liste) summe += k.gewicht

  let wurf = s.rng.next() * summe
  for (let i = 0; i < liste.length; i++) {
    wurf -= liste[i].gewicht
    if (wurf > 0) continue
    const gewaehlt = liste[i]
    liste.splice(i, 1)
    return gewaehlt.bauen()
  }

  // Rundungsreste: den letzten nehmen, statt nichts zurueckzugeben.
  const letzter = liste.pop()
  return letzter === undefined ? null : letzter.bauen()
}

/**
 * `anzahl` verschiedene Angebote ziehen.
 *
 * Die erste Karte kommt ausschliesslich aus dem Waffentopf, solange dort
 * ueberhaupt etwas liegt. Das ist die Garantie, dass nie ein reiner
 * Statistik-Bildschirm erscheint - genau das Gefuehl, das weg soll.
 */
export function zieheAngebote(s: Spielstand, anzahl: number): Aufwertung[] {
  const waffen = waffenKandidaten(s)
  const passiv = passivKandidaten(s)
  const ergebnis: Aufwertung[] = []

  const erste = ziehe(s, waffen)
  if (erste !== null) ergebnis.push(erste)

  const alle = waffen.concat(passiv)
  while (ergebnis.length < anzahl) {
    const naechste = ziehe(s, alle)
    if (naechste === null) break
    ergebnis.push(naechste)
  }
  return ergebnis
}
