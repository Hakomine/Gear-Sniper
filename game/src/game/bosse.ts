import { FARBEN } from '../render/palette'
import type { GegnerArt } from './enemies'
import { QUELLE_BOSS, verfuegbareArten } from './enemies'
import { bruchwelle, KERN, kernAngriffe, kittTick, kuendigeBruchwelleAn, schalenBruch } from './kern'
import { legeGegner } from './spawner'
import type { Gegner, Spielstand } from './state'
import { risseLoeschen } from './risse'
import { gegnerImUmkreis, legeEffekt, legeZone } from './welt'

/**
 * Bosse.
 *
 * Sie laufen im **normalen Gegner-Pool** mit, statt einen eigenen zu bekommen.
 * Damit erben sie Risse, Zersplitterung, Rueckstoss und die gesamte
 * Trefferkette umsonst - und ein Boss geht nur mit mehreren *verschiedenen*
 * Waffen schnell zu Boden. Bessere Werbung fuer die Kernregel gibt es nicht.
 *
 * Zwei Dinge sind hier nicht verhandelbar:
 *
 * 1. **Jeder Angriff hat eine Vorwarnung.** Ein Boss ohne Telegraf ist nicht
 *    schwer, sondern unfair - man verliert, ohne zu verstehen warum. Schwer
 *    heisst: Man *sieht* es kommen und muss trotzdem etwas koennen.
 * 2. **Phase zwei aendert das Muster, nicht die Zahlen.** Mehr Trefferpunkte
 *    sind kein zweiter Kampf, sondern derselbe in laenger.
 */

export type AngriffId = 'speichen' | 'sturm' | 'ringe' | 'ruf' | 'bruchwelle'

export type BossArt = {
  readonly id: string
  readonly name: string
  readonly farbe: string
  readonly radius: number
  readonly hp: number
  readonly tempo: number
  readonly schaden: number
  readonly xp: number
  readonly angriffe: readonly AngriffId[]
  /** Unter diesem Anteil der Trefferpunkte greift Phase zwei. */
  readonly phaseSchwelle: number
  /** Sekunden zwischen zwei Angriffen. */
  readonly takt: number

  // --- Nur der Kern setzt die folgenden ------------------------------------
  // Sie stehen hier und nicht in einem eigenen Bosstyp, weil ein Boss im Spiel
  // schon zweierlei ist: ein Gegner im normalen Pool und ein Zustandsautomat.
  // Ein dritter Sonderweg fuer *einen* Gegner waere teurer zu lesen als fuenf
  // Felder, die bei allen anderen `undefined` bleiben.

  /**
   * Faktor auf gewoehnlichen Schaden. `undefined` heisst: voll.
   *
   * Der Kern steht auf 0,1 - normale Treffer kratzen ihn kaum. Er ist damit
   * der einzige Gegner im Spiel, den man praktisch nur ueber die Kernregel
   * legt, und der Endkampf ist eine Pruefung auf genau das, was das Spiel die
   * ganze Zeit lehrt.
   */
  readonly daempfung?: number
  /** Was eine Zersplitterung ihm abnimmt. `undefined`: `BOSS_ZERSPLITTER_ANTEIL`. */
  readonly splitterAnteil?: number
  /** Sekunden, bis er sich selbst kittet - alle Risse weg. 0/undefined: nie. */
  readonly kittTakt?: number
  /** Wie viele Schalen er hat. `undefined` heisst: keine, dafuer zwei Phasen. */
  readonly schalen?: number
  /** Der letzte Gegner des Laufs. Faellt er, ist der Lauf gewonnen. */
  readonly istKern?: boolean
  /** Umkreis, in dem er die Risse *anderer* schliesst. Nur Flickwerk. */
  readonly flickRadius?: number
}

export type BossZustand = {
  art: BossArt
  phase: number
  angriff: AngriffId | null
  /** Restliche Vorwarnzeit. Groesser als 0 heisst: Angriff ist angekuendigt. */
  telegraf: number
  abkling: number
  zielX: number
  zielY: number
  /** Restzeit des Sturmangriffs - solange praescht der Boss. */
  sturmRest: number
  sturmVx: number
  sturmVy: number

  // --- Nur beim Kern in Gebrauch -------------------------------------------

  /** Wie viele Schalen noch stehen. Zaehlt von `art.schalen` herunter. */
  schale: number
  /** Restzeit bis zur naechsten Selbstkittung. */
  kittRest: number
  /** Steht die Vorwarnung der Kittung schon im Bild? */
  kittGemeldet: boolean
  /** Restzeit der Unverwundbarkeit nach einem Schalenbruch. */
  unverwundbar: number
}

/**
 * Bosse brauchen einen `GegnerArt`-Eintrag, weil sie im selben Pool liegen.
 *
 * Form `sechseck` fuer alle drei: Die Formsprache sagt "Elite", die Groesse
 * sagt "Boss". Eine vierte Form einzufuehren wuerde die Sprache verwaessern,
 * die bei tausend Gegnern das Lesen erst moeglich macht.
 */
function bossArtAlsGegner(b: BossArt): GegnerArt {
  return {
    id: `boss:${b.id}`,
    name: b.name,
    form: 'sechseck',
    // Bosse laufen nicht ueber die Gegner-Registratur - `bewegeGegner` zweigt
    // sie vorher zu `bossTick` ab. Der Eintrag steht nur da, damit der Typ
    // vollstaendig ist.
    verhalten: 'jaeger',
    farbe: b.farbe,
    radius: b.radius,
    hp: b.hp,
    tempo: b.tempo,
    schaden: b.schaden,
    xp: b.xp,
    masse: 40,
    abSekunde: 0,
    gewicht: 0,
    gewichtSpaet: 0,
  }
}

export const BOSSE: readonly BossArt[] = [
  {
    id: 'waechter',
    name: 'Wächter',
    farbe: '#ff6b3d',
    radius: 48,
    hp: 900,
    tempo: 34,
    schaden: 26,
    xp: 140,
    angriffe: ['speichen', 'sturm'],
    phaseSchwelle: 0.5,
    takt: 2.6,
  },
  {
    id: 'kolossus',
    name: 'Kolossus',
    farbe: '#8f7bff',
    radius: 62,
    hp: 1000,
    tempo: 28,
    schaden: 34,
    xp: 260,
    angriffe: ['ringe', 'ruf', 'sturm'],
    phaseSchwelle: 0.5,
    takt: 2.4,
  },
  {
    id: 'zerbrecher',
    name: 'Zerbrecher',
    farbe: '#ff4d5e',
    radius: 72,
    hp: 1300,
    tempo: 32,
    schaden: 42,
    xp: 420,
    angriffe: ['speichen', 'sturm', 'ringe', 'ruf'],
    phaseSchwelle: 0.4,
    takt: 2.0,
  },
  {
    /*
     * Flickwerk - der Boss, der die Kernregel angreift.
     *
     * Er ist der Kitt in gross: Er schliesst die Risse von allem um sich
     * herum *und* alle fuenf Sekunden seine eigenen. Damit zwingt er den Kampf
     * weg vom Pulk - im Getuemmel steht er in seiner eigenen Werkstatt - und
     * er ist die Generalprobe fuer den Kern, an dem genau dieselbe Frage
     * haengt: Schaffst du drei verschiedene Waffen *innerhalb* eines Fensters?
     *
     * Fuenf Sekunden sind bewusst lang. Ein gemischter Bau merkt kaum etwas,
     * ein Bau aus zwei ausgereizten Waffen merkt alles - und das ist die
     * Ansage, die der Boss machen soll.
     */
    id: 'flickwerk',
    name: 'Flickwerk',
    farbe: '#ff3fa4',
    radius: 56,
    hp: 1050,
    tempo: 36,
    schaden: 30,
    xp: 300,
    angriffe: ['ruf', 'ringe', 'speichen'],
    phaseSchwelle: 0.45,
    takt: 2.4,
    kittTakt: 5,
    flickRadius: 260,
  },
]

/*
 * Die Trefferpunkte sind ein erster Wurf und ausdruecklich zum Nachtunen da.
 * Gemessen: Mit 1600/1800/2400 stand nach 400 Sekunden erst der zweite Boss -
 * die naechste Welle wartet naemlich, bis der aktuelle liegt, und damit wurde
 * der 90-Sekunden-Takt bedeutungslos. Ein Boss soll ein Ereignis sein, kein
 * Dauerzustand.
 */

/**
 * Die Trefferpunkte eines Bosses ueber die Zeit.
 *
 * Bewusst **nicht** `hpFaktor` aus `enemies.ts`. Der ist quadratisch und
 * gehoert dem Schwarm: Er sorgt dafuer, dass 1400 Wellengegner in der zehnten
 * Minute noch gefaehrlich sind. Auf einen Boss angewendet ergibt er in der
 * zehnten Minute den Faktor 71 - gemessen wurden damit Bosskaempfe von 120 bis
 * 195 Sekunden, und weil die naechste Welle wartet, bis der aktuelle liegt,
 * blieb es bei drei Bossen in zehn Minuten statt sieben.
 *
 * Ein Boss soll ein Ereignis sein, kein Belagerungszustand. Diese Kurve ist
 * flach genug, dass der Kampf bei einer halben bis knapp einer Minute bleibt,
 * und steil genug, dass er nie zur Formsache wird. Der Beruehrungs- und
 * Geschossschaden skaliert weiter mit dem Schwarm - gefaehrlich bleibt er also.
 */
export function bossHpFaktor(zeit: number): number {
  const min = zeit / 60
  return 1 + min * 1.0 + min * min * 0.05
}

/** Wann der erste Boss kommt und in welchem Abstand die weiteren. */
const ERSTER_BOSS = 90
const BOSS_TAKT = 90

/**
 * Welcher Boss zur `nummer`-ten Bosswelle gehoert.
 *
 * Reihum, nicht "der letzte fuer immer". Vorher blieb es ab der vierten Welle
 * beim Zerbrecher, und damit bestand die zweite Haelfte jedes Laufs aus
 * demselben Kampf - genau das, was an "alles fuehlt sich gleich an" schon
 * einmal falsch war. Seit ein Lauf sechs Etappen bis zum Kern hat, faellt es
 * doppelt auf: Man saehe vier davon denselben Gegner.
 *
 * Dass der Wechsel bei Etappe fuenf wieder beim Waechter anfaengt, ist kein
 * Rueckschritt: Seine Trefferpunkte laufen ueber `bossHpFaktor` mit der Zeit
 * mit, und die Zerruettung legt noch einmal drauf.
 */
export function bossFuer(nummer: number): BossArt {
  return BOSSE[nummer % BOSSE.length]
}

export function naechsteBossZeit(nummer: number): number {
  return ERSTER_BOSS + nummer * BOSS_TAKT
}

/** Laeuft gerade ein Boss? Fuer die Leiste und damit nie zwei gleichzeitig kommen. */
export function findeBoss(s: Spielstand): Gegner | null {
  const liste = s.gegner.aktiv
  for (let i = 0; i < liste.length; i++) {
    if (liste[i].bossZustand !== null && !liste[i].tot) return liste[i]
  }
  return null
}

/** Bosswelle faellig? Dann setzen. */
export function bossWelle(s: Spielstand): void {
  if (s.zeit < naechsteBossZeit(s.bossNummer)) return
  // Nie zwei Wellen uebereinander: Der Takt schiebt sich, bis der aktuelle
  // liegt. Die Tuer "Zwillinge" setzt beide Bosse in *derselben* Welle - das
  // ist etwas anderes und laeuft unten ueber `etappenWerte.bosse`.
  if (findeBoss(s) !== null) return

  /*
   * Zerruettung setzt einen Boss drauf - ab der zweiten Stufe, gedeckelt.
   *
   * Ohne Deckel stuenden in der fuenften Schleife sechs Bosse gleichzeitig, und
   * dann ist es kein Bosskampf mehr, sondern ein Teppich mit Lebensbalken.
   * Zwei zusaetzliche reichen: Der Sprung von einem auf zwei ist der grosse,
   * alles danach ist Menge.
   */
  const zusatz = Math.min(2, Math.max(0, s.zerruettung - 1))
  for (let i = 0; i < s.etappenWerte.bosse + zusatz; i++) setzeBoss(s)
}

function setzeBoss(s: Spielstand): void {

  const art = bossFuer(s.bossNummer)

  // Etwas naeher als der Spawnring: Der Boss soll gesehen werden, bevor er da
  // ist, aber nicht erst nach zehn Sekunden Anmarsch.
  const winkel = s.rng.next() * Math.PI * 2
  const r = s.sichtRadius * 0.85
  const g = legeGegner(
    s,
    bossArtAlsGegner(art),
    s.spieler.x + Math.cos(winkel) * r,
    s.spieler.y + Math.sin(winkel) * r,
  )
  // Erst weiterzaehlen, wenn er wirklich steht. Steht das Feld am Deckel,
  // liefert der Pool nichts - und mit einem vorschnellen `bossNummer++` waere
  // die Welle stillschweigend uebersprungen. Genau in der spaeten Phase, wo
  // der Deckel erreicht wird, faellt der Boss dann aus.
  if (g === null) return
  s.bossNummer++

  // `legeGegner` hat die Schwarmkurve angelegt - fuer einen Boss wird sie
  // hier durch die eigene ersetzt.
  g.maxHp = art.hp * bossHpFaktor(s.zeit) * (1 + s.zerruettung * 0.6)
  g.hp = g.maxHp

  g.bossZustand = {
    art,
    phase: 1,
    angriff: null,
    telegraf: 0,
    // Kurze Gnade nach dem Auftritt, damit man ihn erst einmal sieht.
    abkling: 1.8,
    zielX: 0,
    zielY: 0,
    sturmRest: 0,
    sturmVx: 0,
    sturmVy: 0,
    schale: art.schalen ?? 0,
    kittRest: art.kittTakt ?? 0,
    kittGemeldet: false,
    unverwundbar: 0,
  }
  s.blitz = Math.max(s.blitz, 0.5)
  s.trauma = Math.min(1, s.trauma + 0.4)
}

/**
 * Den Kern rufen - das Ende des Laufs.
 *
 * Steht hier und nicht in `kern.ts`, weil das Setzen eines Bosses in allen
 * Einzelheiten dasselbe ist wie bei den drei anderen: eigener Trefferpunkte-
 * Faktor statt der Schwarmkurve, Zustandsobjekt, Auftrittsblitz. Was den Kern
 * ausmacht, steht in `kern.ts`; wie ein Boss in die Welt kommt, hier.
 */
export function rufeKern(s: Spielstand): Gegner | null {
  const winkel = s.rng.next() * Math.PI * 2
  const r = s.sichtRadius * 0.9
  const g = legeGegner(
    s,
    bossArtAlsGegner(KERN),
    s.spieler.x + Math.cos(winkel) * r,
    s.spieler.y + Math.sin(winkel) * r,
  )
  if (g === null) return null

  // Eigene Kurve *und* Zerruettung: Wer zum dritten Mal am Kern vorbeigegangen
  // ist, soll ihn nicht mehr so vorfinden, wie er ihn beim ersten Mal stehen
  // gelassen hat.
  g.maxHp = KERN.hp * bossHpFaktor(s.zeit) * (1 + s.zerruettung * 0.6)
  g.hp = g.maxHp
  g.radius = KERN.radius
  g.bossZustand = {
    art: KERN,
    phase: 1,
    angriff: null,
    telegraf: 0,
    abkling: 2.6,
    zielX: 0,
    zielY: 0,
    sturmRest: 0,
    sturmVx: 0,
    sturmVy: 0,
    schale: KERN.schalen ?? 3,
    kittRest: KERN.kittTakt ?? 0,
    kittGemeldet: false,
    unverwundbar: 0,
  }
  s.blitz = Math.max(s.blitz, 0.9)
  s.trauma = 1
  s.klaenge.melde('boss', 1.5)
  return g
}

/** Ein Boss-Tick: Bewegung, Vorwarnung, Angriff, Phasenwechsel. */
export function bossTick(s: Spielstand, g: Gegner, dt: number): void {
  const z = g.bossZustand
  if (z === null) return

  if (z.unverwundbar > 0) z.unverwundbar -= dt

  /*
   * Schalen statt Phasen - nur der Kern hat sie.
   *
   * Zwei Phasen sind fuer den letzten Gegner des Laufs zu wenig: Sie geben
   * dem Kampf eine Mitte, aber keinen Verlauf. Drei Schalen geben ihm drei
   * spuerbare Abschnitte, und jeder faengt damit an, dass etwas passiert.
   */
  // Flickwerk schliesst die Risse von allem um sich herum. Eigene Liste, weil
  // `gegnerImUmkreis` das Ergebnisarray des Aufrufers benutzt und die Kitt-
  // Liste in `gegnerVerhalten.ts` waehrend derselben Schleife in Gebrauch ist.
  if (z.art.flickRadius !== undefined) flicke(s, g, z, dt)

  if (z.schale > 0) {
    /*
     * Drei Schalen, drei Schwellen - und keine davon liegt auf null.
     *
     * Bei drei Schalen sind es 75, 50 und 25 Prozent. Die naheliegende
     * Rechnung (zwei Schwellen bei 66 und 33) legt die dritte auf den Tod
     * selbst, und dann ist der letzte Bruch kein Ereignis mehr, sondern nur
     * das Ende. So bleibt nach dem dritten Bruch ein Viertel Kampf uebrig, in
     * dem er alles kann, was er hat.
     */
    const schwelle = z.schale / ((z.art.schalen ?? 1) + 1)
    if (g.hp / g.maxHp <= schwelle) schalenBruch(s, g, z)
  }
  // Selbstkittung: Der Kern hat sie, Flickwerk auch. Sie steht ausserhalb des
  // Schalenblocks, weil sie nichts mit Schalen zu tun hat.
  kittTick(s, g, z, dt)

  // Phasenwechsel: einmalig, mit Ansage.
  if (z.phase === 1 && g.hp / g.maxHp <= z.art.phaseSchwelle) {
    z.phase = 2
    z.telegraf = 0
    z.angriff = null
    z.abkling = 1.2
    s.blitz = Math.max(s.blitz, 0.7)
    s.trauma = Math.min(1, s.trauma + 0.5)
    legeEffekt(s, 'ring', g.x, g.y, z.art.radius * 5, 0.7, z.art.farbe, 5)
  }

  if (z.sturmRest > 0) {
    // Eigene Geschwindigkeit statt des Rueckstoss-Feldes: Der wird gedaempft,
    // und ein Sturmangriff, der auf halber Strecke ausrollt, ist keiner.
    z.sturmRest -= dt
    g.x += z.sturmVx * dt
    g.y += z.sturmVy * dt
    return
  }

  if (z.telegraf > 0) {
    z.telegraf -= dt
    if (z.telegraf <= 0) fuehreAus(s, g, z)
    // Waehrend der Vorwarnung steht der Boss still. Das ist der Moment, in dem
    // der Spieler liest, was kommt - Bewegung wuerde ihn nur verwischen.
    return
  }

  // Langsam nachsetzen.
  const dx = s.spieler.x - g.x
  const dy = s.spieler.y - g.y
  const laenge = Math.hypot(dx, dy) || 1
  g.x += (dx / laenge) * g.tempo * dt
  g.y += (dy / laenge) * g.tempo * dt

  z.abkling -= dt
  if (z.abkling > 0) return
  kuendigeAn(s, g, z)
}

/** Wiederverwendete Nachbarliste des Flickwerks. */
const geflickt: Gegner[] = []

/**
 * Flickwerk repariert seine Umgebung.
 *
 * Derselbe Griff wie beim Kitt, nur mit Bossreichweite: Im Getuemmel stehen
 * seine Nachbarn dauerhaft rissfrei, und der Spieler kommt an keine
 * Zersplitterung heran. Die Antwort darauf ist raeumlich - ihn wegziehen oder
 * hinterhergehen -, nicht mehr Schaden.
 */
function flicke(s: Spielstand, g: Gegner, z: BossZustand, dt: number): void {
  const radius = z.art.flickRadius
  if (radius === undefined) return
  g.takt -= dt
  if (g.takt > 0) return
  g.takt = 1.1

  gegnerImUmkreis(s, g.x, g.y, radius, geflickt)
  for (let i = 0; i < geflickt.length; i++) {
    const n = geflickt[i]
    // Weder sich selbst noch einen zweiten Boss: Sonst decken sich zwei
    // Flickwerke gegenseitig, und das ist genau der Fehler, den der Kitt schon
    // einmal hatte.
    if (n === g || n.bossZustand !== null || n.risse === 0) continue
    risseLoeschen(n)
  }
  legeEffekt(s, 'ring', g.x, g.y, radius, 0.4, z.art.farbe, 3)
}

/** Angriff auswaehlen und ankuendigen. */
function kuendigeAn(s: Spielstand, g: Gegner, z: BossZustand): void {
  // Der Kern schaltet seine Angriffe erst mit den Schalen frei - siehe
  // `kernAngriffe`. Alle anderen koennen von Anfang an alles.
  const bis = z.art.istKern === true ? kernAngriffe(z) : z.art.angriffe.length
  const angriff = z.art.angriffe[Math.floor(s.rng.next() * bis)]
  z.angriff = angriff
  s.klaenge.melde('warnung')
  z.zielX = s.spieler.x
  z.zielY = s.spieler.y

  switch (angriff) {
    case 'speichen': {
      z.telegraf = 1.0
      // Speichen andeuten, damit man die Luecken vorher sieht.
      const speichen = z.phase === 1 ? 5 : 7
      for (let i = 0; i < speichen; i++) {
        const w = (i / speichen) * Math.PI * 2
        const e = legeEffekt(s, 'strich', g.x, g.y, 0, 1.0, FARBEN.gefahr, 2)
        if (e === null) continue
        e.x2 = g.x + Math.cos(w) * 260
        e.y2 = g.y + Math.sin(w) * 260
        e.warnung = true
      }
      break
    }
    case 'sturm': {
      z.telegraf = 0.8
      const e = legeEffekt(s, 'strich', g.x, g.y, 0, 0.8, FARBEN.gefahr, 6)
      if (e !== null) {
        e.x2 = z.zielX
        e.y2 = z.zielY
        e.warnung = true
      }
      break
    }
    case 'ringe': {
      z.telegraf = 0.9
      const e = legeEffekt(s, 'ring', g.x, g.y, 300, 0.9, FARBEN.gefahr, 4)
      if (e !== null) e.warnung = true
      break
    }
    case 'bruchwelle': {
      z.telegraf = 1.1
      kuendigeBruchwelleAn(s, g)
      break
    }
    case 'ruf': {
      z.telegraf = 1.2
      for (let i = 0; i < 8; i++) {
        const w = (i / 8) * Math.PI * 2
        const e = legeEffekt(
          s,
          'ring',
          s.spieler.x + Math.cos(w) * 190,
          s.spieler.y + Math.sin(w) * 190,
          26,
          1.2,
          FARBEN.gefahr,
          3,
        )
        if (e !== null) e.warnung = true
      }
      break
    }
  }
}

/** Die Vorwarnung ist abgelaufen - jetzt passiert es. */
function fuehreAus(s: Spielstand, g: Gegner, z: BossZustand): void {
  z.abkling = z.art.takt

  switch (z.angriff) {
    case 'speichen':
      speichenfeuer(s, g, z)
      break
    case 'sturm':
      sturmangriff(s, g, z)
      break
    case 'ringe':
      schockringe(s, g, z)
      break
    case 'ruf':
      bruchruf(s, g)
      break
    case 'bruchwelle':
      bruchwelle(s, g, z)
      break
  }
  z.angriff = null
}

function speichenfeuer(s: Spielstand, g: Gegner, z: BossZustand): void {
  const salven = z.phase === 1 ? 1 : 2
  const speichen = z.phase === 1 ? 5 : 7

  for (let salve = 0; salve < salven; salve++) {
    // Phase zwei feuert eine zweite Salve gegenlaeufig versetzt: Die Luecken
    // wandern gegeneinander, und ein fester Standpunkt reicht nicht mehr.
    const versatz = salve === 0 ? 0 : Math.PI / speichen
    for (let i = 0; i < speichen; i++) {
      const w = (i / speichen) * Math.PI * 2 + versatz
      const tempo = salve === 0 ? 210 : 170
      schiess(s, g, w, tempo, z.art)
    }
  }
  s.trauma = Math.min(1, s.trauma + 0.1)
}

function sturmangriff(s: Spielstand, g: Gegner, z: BossZustand): void {
  const dx = z.zielX - g.x
  const dy = z.zielY - g.y
  const laenge = Math.hypot(dx, dy) || 1
  // Kein Teleport: Der Boss legt die Strecke in etwa einer halben Sekunde
  // zurueck, ausweichen bleibt moeglich.
  const tempo = Math.min(900, laenge / 0.45)
  z.sturmVx = (dx / laenge) * tempo
  z.sturmVy = (dy / laenge) * tempo
  z.sturmRest = 0.5
  s.trauma = Math.min(1, s.trauma + 0.18)
}

function schockringe(s: Spielstand, g: Gegner, z: BossZustand): void {
  const anzahl = z.phase === 1 ? 2 : 3
  for (let i = 0; i < anzahl; i++) {
    const ring = legeZone(
      s,
      'knall',
      g.x,
      g.y,
      300 + i * 40,
      // Gestaffelt: Die Ringe laufen nacheinander los.
      1.1 + i * 0.45,
      z.art.schaden * 0.7,
      -1,
      z.art.farbe,
    )
    ring.feindlich = true
    ring.wachsend = true
  }
}

function bruchruf(s: Spielstand, g: Gegner): void {
  const arten = verfuegbareArten(s.zeit)
  const art = arten[arten.length - 1]
  for (let i = 0; i < 8; i++) {
    const w = (i / 8) * Math.PI * 2
    legeGegner(s, art, s.spieler.x + Math.cos(w) * 190, s.spieler.y + Math.sin(w) * 190)
  }
  legeEffekt(s, 'ring', g.x, g.y, 120, 0.3, g.art.farbe, 3)
}

function schiess(s: Spielstand, g: Gegner, winkel: number, tempo: number, art: BossArt): void {
  if (s.feindSchuesse.anzahl >= 300) return
  const p = s.feindSchuesse.nimm()
  p.x = g.x
  p.y = g.y
  p.vx = Math.cos(winkel) * tempo
  p.vy = Math.sin(winkel) * tempo
  p.radius = 8
  p.schaden = art.schaden * 0.75
  p.leben = 5
  p.farbe = art.farbe
  // Alle Bosse teilen sich eine Quelle: Sie stehen nicht in `GEGNER_ARTEN`,
  // und fuer die Kernscherbe ist "ein Boss" ohnehin eine einzige Kategorie.
  p.quelle = QUELLE_BOSS
}
