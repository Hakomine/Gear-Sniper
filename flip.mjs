// Gear Sniper – Flip-Buch
//
// Wozu: der Sniper schaetzt den Verkaufserloes. Ob die Schaetzung stimmt, weiss
// er nicht – bis hier echte Zahlen drinstehen. Nach etwa zehn Verkaeufen zeigt
// der Vergleich "geschaetzt vs. wirklich bekommen", wie realFaktor eingestellt
// gehoert. Vorher ist jede Marge eine begruendete Annahme, keine Messung.
//
// Und die zweite Frage, die nur hier beantwortet wird: hat sich der ganze
// Aufwand gelohnt? Ohne Buch bleibt davon nur ein Gefuehl.
//
// BENUTZEN:
//   node flip.mjs kauf  "RTX 4070"  260  --ort=Moers --km=13 --erwartet=430
//   node flip.mjs verkauf 3         395  --gebuehr=43 --versand=7
//   node flip.mjs offen
//   node flip.mjs bilanz
//
// Die Nummer beim Verkauf ist die laufende Nummer aus "offen".

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATEI = path.join(__dirname, 'flips.json');

const args = process.argv.slice(2);
const befehl = args[0];
const opt = (name, def = null) => {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : def;
};
const zahl = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const lade = () => {
  try {
    return JSON.parse(fs.readFileSync(DATEI, 'utf8'));
  } catch {
    return { flips: [] };
  }
};
const sichere = (d) => fs.writeFileSync(DATEI, JSON.stringify(d, null, 2), 'utf8');

const e = (n) => (n == null ? '–' : n.toFixed(2).replace('.', ',') + ' €');
const tage = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400e3));

function kauf() {
  const modell = args[1];
  const preis = zahl(args[2]);
  if (!modell || preis == null) {
    console.log('So: node flip.mjs kauf "RTX 4070" 260 --ort=Moers --km=13 --erwartet=430');
    process.exit(1);
  }
  const d = lade();
  const nr = (d.flips.at(-1)?.nr || 0) + 1;
  d.flips.push({
    nr,
    modell,
    gekauftAm: new Date().toISOString().slice(0, 10),
    einkauf: preis,
    ort: opt('ort'),
    km: zahl(opt('km')),
    // Was der Sniper versprochen hat. Genau diese Zahl wird spaeter mit dem
    // echten Erloes verglichen - das ist der ganze Zweck des Buchs.
    erwartet: zahl(opt('erwartet')),
    verkauf: null,
  });
  sichere(d);
  console.log(`#${nr} eingetragen: ${modell} für ${e(preis)}${opt('ort') ? ' aus ' + opt('ort') : ''}`);
}

function verkauf() {
  const nr = +args[1];
  const erloes = zahl(args[2]);
  if (!nr || erloes == null) {
    console.log('So: node flip.mjs verkauf 3 395 --gebuehr=43 --versand=7');
    process.exit(1);
  }
  const d = lade();
  const f = d.flips.find((x) => x.nr === nr);
  if (!f) return console.log(`#${nr} gibt es nicht.`), process.exit(1);
  if (f.verkauf) return console.log(`#${nr} ist schon als verkauft eingetragen.`), process.exit(1);

  f.verkauf = {
    am: new Date().toISOString().slice(0, 10),
    erloes,
    gebuehr: zahl(opt('gebuehr')) ?? 0,
    versand: zahl(opt('versand')) ?? 0,
  };
  sichere(d);

  const netto = erloes - f.einkauf - f.verkauf.gebuehr - f.verkauf.versand;
  const liegen = tage(f.gekauftAm, f.verkauf.am);
  console.log(`#${nr} ${f.modell}: ${e(f.einkauf)} → ${e(erloes)} = netto ${e(netto)} nach ${liegen} Tagen`);
  if (f.erwartet) {
    const ab = Math.round(((erloes - f.erwartet) / f.erwartet) * 100);
    console.log(`   erwartet waren ${e(f.erwartet)} – tatsächlich ${ab >= 0 ? '+' : ''}${ab} %`);
  }
}

function offen() {
  const d = lade();
  const o = d.flips.filter((f) => !f.verkauf);
  if (!o.length) return console.log('Nichts offen – kein Kapital gebunden.');
  let summe = 0;
  console.log('Offene Posten:');
  for (const f of o) {
    summe += f.einkauf;
    console.log(
      `  #${String(f.nr).padStart(3)} ${f.modell.padEnd(20)} ${e(f.einkauf).padStart(10)} · ` +
        `seit ${tage(f.gekauftAm, new Date().toISOString())} Tagen${f.ort ? ' · ' + f.ort : ''}`
    );
  }
  console.log(`\n  ${o.length} Stück · ${e(summe)} gebunden`);
}

function bilanz() {
  const d = lade();
  const fertig = d.flips.filter((f) => f.verkauf);
  const offenListe = d.flips.filter((f) => !f.verkauf);

  if (!fertig.length) {
    console.log('Noch kein abgeschlossener Flip. Die Bilanz braucht mindestens einen Verkauf.');
    if (offenListe.length) console.log(`(${offenListe.length} offen, ${e(offenListe.reduce((s, f) => s + f.einkauf, 0))} gebunden)`);
    return;
  }

  let einsatz = 0;
  let gewinn = 0;
  let liegetage = 0;
  // Nur Flips mit Erwartungswert taugen zum Kalibrieren.
  let mitSchaetzung = 0;
  let abweichung = 0;

  for (const f of fertig) {
    const netto = f.verkauf.erloes - f.einkauf - f.verkauf.gebuehr - f.verkauf.versand;
    einsatz += f.einkauf;
    gewinn += netto;
    liegetage += tage(f.gekauftAm, f.verkauf.am);
    if (f.erwartet) {
      mitSchaetzung++;
      abweichung += f.verkauf.erloes / f.erwartet;
    }
  }

  console.log(`Flip-Buch · ${fertig.length} abgeschlossen, ${offenListe.length} offen\n`);
  console.log(`  Eingesetzt      ${e(einsatz)}`);
  console.log(`  Gewinn          ${e(gewinn)}  (${Math.round((gewinn / einsatz) * 100)} % auf den Einsatz)`);
  console.log(`  je Flip         ${e(gewinn / fertig.length)}`);
  console.log(`  Liegezeit       ${Math.round(liegetage / fertig.length)} Tage im Schnitt`);
  if (offenListe.length) {
    console.log(`  gebunden        ${e(offenListe.reduce((s, f) => s + f.einkauf, 0))} in ${offenListe.length} Posten`);
  }

  if (mitSchaetzung >= 3) {
    const faktor = abweichung / mitSchaetzung;
    console.log(`\n  Schätzung vs. Wirklichkeit (${mitSchaetzung} Verkäufe):`);
    console.log(`  Du hast im Schnitt ${Math.round((faktor - 1) * 100)} % ${faktor >= 1 ? 'MEHR' : 'WENIGER'} bekommen als der Sniper vorhergesagt hat.`);
    if (mitSchaetzung < 10) {
      console.log(`  Ab etwa 10 Verkäufen ist das belastbar – bis dahin nicht überinterpretieren.`);
    } else {
      const alt = 0.95;
      console.log(`  → realFaktor in config.json von ${alt} auf ${(alt * faktor).toFixed(2)} setzen.`);
    }
  } else if (mitSchaetzung) {
    console.log(`\n  Für die Kalibrierung fehlen noch ${3 - mitSchaetzung} Verkäufe mit --erwartet=.`);
  }
}

const befehle = { kauf, verkauf, offen, bilanz };
if (!befehle[befehl]) {
  console.log('Befehle: kauf · verkauf · offen · bilanz');
  console.log('  node flip.mjs kauf "RTX 4070" 260 --ort=Moers --km=13 --erwartet=430');
  console.log('  node flip.mjs verkauf 3 395 --gebuehr=43 --versand=7');
  console.log('  node flip.mjs offen');
  console.log('  node flip.mjs bilanz');
  process.exit(1);
}
befehle[befehl]();
