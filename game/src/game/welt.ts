import { FARBEN } from '../render/palette'
import { legeZahl, zerspringen } from './effects'
import { heileSpieler } from './player'
import { GEGNER_VERHALTEN } from './gegnerVerhalten'
import {
  BOSS_ZERSPLITTER_ANTEIL,
  KASKADE_MAX_TIEFE,
  rissBonus,
  risseLoeschen,
  rissSetzen,
  ZERSPLITTER_ANTEIL,
  ZERSPLITTER_NACHBAR_ANTEIL,
  ZERSPLITTER_RADIUS,
  zersplitterBereit,
} from './risse'
import type { Effekt, Gegner, Geschoss, Spielstand, Zone } from './state'
import { MAX_WAFFEN } from './weapons'

/**
 * Auf die Welt einwirken.
 *
 * Alles, was die Waffenverhalten brauchen: Ziele finden, Schaden austeilen,
 * Geschosse, Zonen und Effekte in die Welt setzen. Vorher lag das als private
 * Funktionen in `state.ts` - dort kam niemand heran, und `state.ts` war
 * ohnehin schon die groesste Datei.
 *
 * Diese Datei bezieht aus `state.ts` nur *Typen*. Die Import-Richtung bleibt
 * damit sternfoermig: state -> verhalten -> welt, und nie zurueck.
 */

/**
 * Eigenes Ergebnisarray - und das ist kein Detail.
 *
 * `state.ts` iteriert in der Geschossschleife ueber sein eigenes
 * Kandidaten-Array. Wuerde eine Explosion mitten darin dasselbe Array fuer
 * ihre Umkreisabfrage benutzen, ueberschriebe sie die Liste, ueber die gerade
 * gelaufen wird: Treffer verschwinden sporadisch, und der Fehler ist beim
 * Suchen die Hoelle. Jede Abfrage von hier nutzt deshalb ausschliesslich
 * dieses Array.
 */
const rohIds: number[] = []

/**
 * Der Guertelplatz, unter dem Scherben ihren Riss setzen.
 *
 * Liegt hinter allen echten Waffenplaetzen. Dadurch koennen Scherben selbst
 * der dritte Riss eines Nachbarn sein - und genau daraus entsteht die
 * Kettenreaktion durch die Menge.
 */
export const SPLITTER_PLATZ = MAX_WAFFEN

/**
 * Der Platz des Geisterrisses (Charakter "Riss").
 *
 * Ein eigenes Bit, kein geteiltes: Waere er derselbe wie die Scherben, koennte
 * eine Splitterwelle den Geisterriss "verbrauchen" und die Mechanik waere
 * unberechenbar.
 */
export const GEIST_PLATZ = MAX_WAFFEN + 1

/** Beruehrungsschaden des Kolosses. */
export const DORNEN_PLATZ = MAX_WAFFEN + 2

/** Wie viele Platznummern es insgesamt gibt - Laenge der Auswertungs-Arrays. */
/**
 * Fehlschlag: Der zusaetzliche Riss aus einem kritischen Treffer.
 *
 * Ein eigener Platz, kein geliehener: Waere es der Platz der Waffe, zaehlte er
 * gar nicht - die hat ihren Riss ja schon gesetzt.
 */
export const KRIT_PLATZ = MAX_WAFFEN + 3

/**
 * Der Riss, den die Vereisung geschenkt gibt (Waffe "Frostkeil").
 *
 * Eigener Platz, kein geliehener - genau wie beim Geisterriss des Riss-
 * Charakters. Waere es der Platz der treffenden Waffe, zaehlte er nicht, denn
 * die hat ihren Riss ja schon gesetzt.
 */
export const FROST_PLATZ = MAX_WAFFEN + 4

export const PLATZ_ANZAHL = MAX_WAFFEN + 5

/**
 * Obergrenze fuer den aufgestauten Rueckstoss eines Gegners.
 *
 * Ohne sie stapeln fuenf gleichzeitig treffende Waffen ihren Rueckstoss zu
 * einer Mauer: Gemessen stand eine Figur, die sich **gar nicht bewegt**, zehn
 * Minuten lang unbehelligt in einer freigeschobenen Blase. Rueckstoss soll
 * Wucht vermitteln, keine Verteidigung sein - wer Abstand will, soll laufen.
 */
const MAX_STOSS = 300

// Warteschlange der Zersplitterungen. Wird innerhalb desselben Ticks
// abgearbeitet - siehe `arbeiteKaskadeAb`.
const warteGegner: Gegner[] = []
const warteTiefe: number[] = []
let laufendeTiefe = 0

/** Naechster lebender Gegner, hoechstens `reichweite` entfernt. */
export function naechsterGegner(
  s: Spielstand,
  x: number,
  y: number,
  reichweite: number,
  ausserId = -1,
): Gegner | null {
  s.gitter.abfragen(x, y, reichweite, rohIds)
  const liste = s.gegner.aktiv
  let bester: Gegner | null = null
  let bestD2 = reichweite * reichweite

  for (let k = 0; k < rohIds.length; k++) {
    const g = liste[rohIds[k]]
    if (g === undefined || g.tot || g.id === ausserId) continue
    const dx = g.x - x
    const dy = g.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      bester = g
    }
  }
  return bester
}

/**
 * Alle lebenden Gegner im Umkreis, in `aus` gesammelt.
 *
 * Der Aufrufer stellt das Array - so kann er selbst dafuer sorgen, dass zwei
 * ineinander laufende Abfragen sich nicht in die Quere kommen.
 */
export function gegnerImUmkreis(
  s: Spielstand,
  x: number,
  y: number,
  radius: number,
  aus: Gegner[],
): Gegner[] {
  aus.length = 0
  s.gitter.abfragen(x, y, radius, rohIds)
  const liste = s.gegner.aktiv
  const r2 = radius * radius

  for (let k = 0; k < rohIds.length; k++) {
    const g = liste[rohIds[k]]
    if (g === undefined || g.tot) continue
    const dx = g.x - x
    const dy = g.y - y
    if (dx * dx + dy * dy <= r2) aus.push(g)
  }
  return aus
}

/**
 * Schaden austeilen - der einzige Weg, einem Gegner wehzutun.
 *
 * `platz` ist der Guertelplatz der verursachenden Waffe. Er entscheidet ueber
 * den Riss, und deshalb muessen Folgewirkungen ihn erben: Der Knall einer
 * Bazooka traegt denselben Platz wie ihr Geschoss.
 */
export function verletzeGegner(
  s: Spielstand,
  g: Gegner,
  basisSchaden: number,
  platz: number,
  krit: boolean,
  stossX: number,
  stossY: number,
): void {
  if (g.tot) return

  // Erst reissen, dann rechnen: Der Treffer, der den dritten Riss setzt, soll
  // den Bonus schon mitnehmen. Das macht den Moment spuerbar, in dem ein Bau
  // greift.
  // Nur der *neue* Riss meldet sich - sonst knackst es bei jedem Treffer, und
  // das Geraeusch verliert genau die Bedeutung, die es tragen soll.
  const sp = s.spieler
  if (rissSetzen(g, platz, sp.rissDauer)) {
    s.klaenge.melde('riss')

    // Kettenriss: Jeder n-te *frische* Riss springt auf einen Nachbarn ueber.
    // Gezaehlt werden neue Risse, nicht Treffer - sonst laege die Wirkung bei
    // einer schnellen Waffe zehnmal so hoch wie bei einer langsamen.
    if (sp.kettenRiss > 0) {
      sp.kettenZaehler++
      if (sp.kettenZaehler >= sp.kettenRiss) {
        sp.kettenZaehler = 0
        springeWeiter(s, g, platz)
      }
    }
  }

  // Fehlschlag: Ein kritischer Treffer reisst zusaetzlich auf - unter einem
  // eigenen Platz, denn den der Waffe hat sie eben selbst belegt.
  if (krit && sp.kritRiss) rissSetzen(g, KRIT_PLATZ, sp.rissDauer)

  // Frostkeil: Was gefroren ist, traegt einen Riss geschenkt - es zerspringt
  // also mit zwei Waffen statt drei.
  if (g.frost > 0) rissSetzen(g, FROST_PLATZ, sp.rissDauer)

  // Charakter "Riss": Drei Sekunden ohne Treffer, und jeder Schlag setzt
  // zusaetzlich einen Geisterriss - er zersplittert damit mit zwei Waffen
  // statt drei. Sauberes Ausweichen wird zur Waffe.
  if (sp.stillstandSchwelle > 0 && sp.stillstand >= sp.stillstandSchwelle) {
    rissSetzen(g, GEIST_PLATZ, sp.rissDauer)
  }

  // Schleiferin: Der aufgestapelte Schliff wirkt auf alles, was sie austeilt.
  const schliff = sp.schliffProNah > 0 ? 1 + sp.schliff * 0.04 : 1

  /*
   * Der Schildtraeger wehrt von vorn fast alles ab.
   *
   * Als Quelle gilt der *Spieler*, nicht das einzelne Geschoss. Praktisch
   * aller Schaden geht ohnehin von ihm aus, und die Ansage soll "komm von
   * hinten" lauten - nicht "such den richtigen Splitterwinkel". Ein Schild,
   * dessen Wirkung von der Flugbahn einer Granate abhaengt, ist nicht lesbar.
   */
  const abwehr = GEGNER_VERHALTEN[g.art.verhalten].schadensFaktor
  const richtung = abwehr === undefined ? 1 : abwehr(g, sp.x, sp.y)

  const schaden = Math.max(1, Math.floor(basisSchaden * rissBonus(g) * schliff * richtung))

  g.hp -= schaden
  g.blitz = 0.09
  s.klaenge.melde('treffer')
  s.statistik.schaden += schaden
  if (platz >= 0 && platz < s.statistik.schadenProPlatz.length) {
    s.statistik.schadenProPlatz[platz] += schaden
  }

  g.stossX += stossX
  g.stossY += stossY
  const stoss = Math.hypot(g.stossX, g.stossY)
  if (stoss > MAX_STOSS) {
    g.stossX = (g.stossX / stoss) * MAX_STOSS
    g.stossY = (g.stossY / stoss) * MAX_STOSS
  }

  if (krit) legeZahl(s, g.x, g.y - g.radius, schaden, true)

  if (g.hp <= 0) {
    g.tot = true
    return
  }

  if (zersplitterBereit(g) && laufendeTiefe < KASKADE_MAX_TIEFE) {
    g.zersplittert = true
    warteGegner.push(g)
    warteTiefe.push(laufendeTiefe)
  }
}

/** Wiederverwendetes Array der Splitter-Nachbarn. */
const nachbarn: Gegner[] = []

/**
 * Eigene Liste fuer den Kettenriss.
 *
 * Muss getrennt von `nachbarn` sein: Der Kettenriss fragt *mitten in einem
 * Treffer* ab, und die Splitterkaskade laeuft ebenfalls durch Treffer. Beide
 * dasselbe Array benutzen zu lassen waere genau die Sorte stiller Fehler, die
 * man erst an falschen Zahlen bemerkt - dieselbe Ueberlegung wie bei `rohIds`
 * ganz oben.
 */
const kettenZiele: Gegner[] = []

/** Den Riss auf den naechsten anderen Gegner uebertragen. */
function springeWeiter(s: Spielstand, von: Gegner, platz: number): void {
  gegnerImUmkreis(s, von.x, von.y, 150, kettenZiele)
  for (let i = 0; i < kettenZiele.length; i++) {
    const n = kettenZiele[i]
    if (n === von || n.tot) continue
    if (!rissSetzen(n, platz, s.spieler.rissDauer)) continue

    const e = legeEffekt(s, 'strich', von.x, von.y, 0, 0.18, FARBEN.treffer, 2)
    if (e !== null) {
      e.x2 = n.x
      e.y2 = n.y
    }
    return
  }
}

/**
 * Alle vorgemerkten Zersplitterungen abarbeiten.
 *
 * Bewusst **nicht** rekursiv: Zersplittern verletzt Nachbarn, das kann dort
 * zersplittern, und in einem dichten Pulk liefe das ohne Bremse durch das
 * halbe Feld - im schlimmsten Fall in einen Stapelueberlauf. Stattdessen eine
 * Warteschlange, die innerhalb desselben Ticks leerlaeuft, mit
 * Tiefenbegrenzung.
 *
 * `nachbarn` darf dabei wiederverwendet werden, weil die Liste eines Eintrags
 * vollstaendig abgearbeitet ist, bevor der naechste abfragt: Schaden reiht nur
 * ein, er fragt nicht selbst ab.
 *
 * Setzt ein aktuelles Gitter voraus (`gitterAufbauen`). Fehlt es, findet die
 * Splitterwelle lautlos keine Nachbarn - der Fehler faellt im Spiel kaum auf
 * und ist deshalb einen Hinweis wert.
 */
export function arbeiteKaskadeAb(s: Spielstand): void {
  for (let i = 0; i < warteGegner.length; i++) {
    const g = warteGegner[i]
    const tiefe = warteTiefe[i]
    if (g.tot) continue

    const istBoss = g.bossZustand !== null
    const sp = s.spieler
    const weite = ZERSPLITTER_RADIUS * s.etappenWerte.splitterWeite * sp.zwillingsbruch
    // Zwillingsbruch: doppelt so weit, dafuer halb so hart. Ein reiner Tausch -
    // er belohnt einen Flaechenbau und bestraft einen auf Einzelziele.
    const wucht =
      (g.maxHp * (istBoss ? BOSS_ZERSPLITTER_ANTEIL : ZERSPLITTER_ANTEIL)) / sp.zwillingsbruch
    g.hp -= wucht
    s.statistik.schaden += wucht
    // Auf das Scherbenkonto, nicht auf das der ausloesenden Waffe: Die
    // Auswertung am Ende soll zeigen, wie viel die eigene Regel beitraegt -
    // und ohne diese Zeile fehlte ausgerechnet der groesste Brocken davon.
    s.statistik.schadenProPlatz[SPLITTER_PLATZ] += wucht
    s.statistik.zersplittert++
    if (g.hp <= 0) g.tot = true

    // Nur der Boss darf erneut zerspringen - und auch er erst, wenn drei
    // verschiedene Waffen ihn wieder aufgerissen haben. Bei allen anderen
    // bleibt das Kennzeichen stehen, bis der Pool sie neu vergibt.
    if (istBoss) {
      g.zersplittert = false
      risseLoeschen(g)
    }

    s.klaenge.melde('zersplittert', istBoss ? 1.4 : 1)
    if (sp.blutglas > 0) heileSpieler(sp, sp.blutglas)
    if (sp.splitterFeld > 0) {
      // Splitterfeld: Was zerspringt, laesst Scherben liegen. Sie erben den
      // Scherbenplatz, damit ihr Schaden in der Auswertung dort landet, wo er
      // hingehoert - und nicht bei irgendeiner Waffe.
      legeZone(
        s,
        'knall',
        g.x,
        g.y,
        weite * 0.8,
        sp.splitterFeld,
        wucht * 0.14,
        SPLITTER_PLATZ,
        FARBEN.treffer,
      )
    }

    zerspringen(s, g.x, g.y, g.radius * 1.6, FARBEN.treffer)
    legeEffekt(s, 'ring', g.x, g.y, weite, 0.3, FARBEN.treffer, 3)
    s.trauma = Math.min(1, s.trauma + 0.06)

    // Tiefer als erlaubt darf die Welle keine neuen Zersplitterungen mehr
    // ausloesen - Schaden macht sie trotzdem.
    laufendeTiefe = tiefe + 1

    gegnerImUmkreis(s, g.x, g.y, weite, nachbarn)
    const anteil = wucht * ZERSPLITTER_NACHBAR_ANTEIL
    for (let k = 0; k < nachbarn.length; k++) {
      const n = nachbarn[k]
      if (n === g) continue
      const dx = n.x - g.x
      const dy = n.y - g.y
      const laenge = Math.hypot(dx, dy) || 1
      verletzeGegner(s, n, anteil, SPLITTER_PLATZ, false, (dx / laenge) * 90, (dy / laenge) * 90)
    }
  }

  warteGegner.length = 0
  warteTiefe.length = 0
  laufendeTiefe = 0
}

// ---------------------------------------------------------------------------
// Dinge in die Welt setzen
// ---------------------------------------------------------------------------

/**
 * Ein Geschoss aus dem Pool holen. Der Aufrufer setzt Bahn und Wirkung selbst
 * - bei acht Verhalten waere eine Funktion mit fuenfzehn Parametern
 * unleserlicher als das hier.
 */
export function nimmGeschoss(s: Spielstand): Geschoss {
  const p = s.geschosse.nimm()
  p.getroffen.clear()
  p.zielsuche = 0
  p.zielId = -1
  p.explosionsRadius = 0
  p.nachwurf = 0
  p.prallt = false
  p.spaltet = 0
  p.kollaps = false
  return p
}

export function legeZone(
  s: Spielstand,
  art: Zone['art'],
  x: number,
  y: number,
  radius: number,
  leben: number,
  schaden: number,
  platz: number,
  farbe: string,
): Zone {
  const z = s.zonen.nimm()
  z.art = art
  z.x = x
  z.y = y
  z.radius = radius
  z.maxRadius = radius
  z.leben = leben
  z.maxLeben = leben
  z.schaden = schaden
  z.platz = platz
  z.farbe = farbe
  z.sogKraft = 0
  z.tickRest = 0
  z.truemmer = false
  z.feindlich = false
  z.wachsend = false
  z.gewitter = false
  return z
}

/** Obergrenze: Effekte sind Zugabe, eine eingebrochene Bildrate ist es nicht. */
const MAX_EFFEKTE = 160

export function legeEffekt(
  s: Spielstand,
  art: Effekt['art'],
  x: number,
  y: number,
  radius: number,
  leben: number,
  farbe: string,
  breite: number,
): Effekt | null {
  if (s.effekte.anzahl >= MAX_EFFEKTE) return null
  const e = s.effekte.nimm()
  e.art = art
  e.x = x
  e.y = y
  e.x2 = x
  e.y2 = y
  e.radius = radius
  e.winkel = 0
  e.spanne = 0
  e.leben = leben
  e.maxLeben = leben
  e.farbe = farbe
  e.breite = breite
  e.warnung = false
  return e
}
