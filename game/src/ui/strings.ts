/**
 * Alle sichtbaren Texte an einer Stelle.
 *
 * Kostet jetzt fuenf Minuten und macht eine Uebersetzung spaeter zum
 * Datei-Tausch statt zur Suchaktion durch den ganzen Quelltext. Wer Texte
 * direkt in den Zeichencode schreibt, findet sie ein halbes Jahr spaeter
 * nicht mehr alle wieder - und genau die eine vergessene Zeile faellt dann
 * im Steam-Test auf.
 */
export const TEXTE = {
  titel: 'SCHERBENFELD',
  untertitel: 'Überlebe, solange du kannst',
  startHinweis: 'LEERTASTE oder A am Gamepad',
  steuerung: 'WASD / Stick bewegt · geschossen wird von allein',

  levelup: 'STUFE ERREICHT',
  levelupHinweis: 'A / D wählen · LEERTASTE bestätigen · oder 1 2 3',
  kartenNeu: 'NEU',
  kartenVollendung: 'VOLLENDUNG',
  kartenStufe: 'Stufe',

  tot: 'ZERBROCHEN',
  gewonnen: 'VOLLENDET',
  gewonnenUnter: 'Der Kern ist gebrochen',
  totHinweis: 'LEERTASTE zurück zur Auswahl',
  punkte: 'PUNKTE',
  bestwert: 'Bester Lauf',
  schadensAnteil: 'Woran sie gestorben sind',
  freigeschaltet: 'FREIGESCHALTET',

  charakterHinweis: 'A / D wählt · W / S wechselt die Reihe · LEERTASTE startet',
  verhexungen: 'VERHEXUNGEN',
  verhexungHinweis: 'Freiwillig schwerer — für mehr Punkte',
  verhexungKeine: 'Keine gewählt · Punkte ×1,00',
  vorteil: 'Dafür',
  nachteil: 'Dagegen',
  gesperrt: 'GESPERRT',
  punkteFaktor: 'Punkte-Faktor',

  atempauseTitel: 'ETAPPE GESCHAFFT',
  atempauseHinweis: 'A / D wählt · LEERTASTE bestätigt · oder 1 2 3',
  tuerPreis: 'Kostet',
  tuerLohn: 'Bringt',
  tuerOhnePreis: 'Nichts wird schwerer',
  etappe: 'ETAPPE',

  pauseTitel: 'ANGEHALTEN',
  pauseWeiter: 'Weiter',
  pauseTon: 'Ton',
  pauseAn: 'an',
  pauseAus: 'aus',
  pauseAufgeben: 'Lauf aufgeben',
  pauseAuswahl: 'Zurück zur Charakterwahl',
  pauseHinweis: 'W / S wählt · LEERTASTE bestätigt · ESC schließt',
  pauseWarnung: 'Aufgeben wertet den Lauf ganz normal aus',

  hudLeben: 'LEBEN',
  hudStufe: 'STUFE',

  ergebnisZeit: 'Überlebt',
  ergebnisKills: 'Erledigt',
  ergebnisStufe: 'Stufe',
  ergebnisSchaden: 'Schaden',
  ergebnisZersplittert: 'Zersplittert',
} as const

/** Sekunden als `m:ss`. */
export function zeitText(sekunden: number): string {
  const m = Math.floor(sekunden / 60)
  const s = Math.floor(sekunden % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Grosse Zahlen kuerzen, damit die Anzeige nicht springt. */
export function zahlText(wert: number): string {
  if (wert < 1000) return String(Math.floor(wert))
  if (wert < 1_000_000) return `${(wert / 1000).toFixed(1)}k`
  return `${(wert / 1_000_000).toFixed(1)}M`
}
