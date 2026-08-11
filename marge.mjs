// Gear Sniper – Margenrechnung
//
// Der Unterschied zwischen "Rabatt" und "Geld". Ein Fund mit −34 % klingt gut,
// aber davon gehen ab: Verkaufsgebuehr, Versandkarton, Sprit fuer Hin- und
// Rueckweg. Und der Verkaufserloes ist nicht der Median der Angebote, denn was
// Leute VERLANGEN ist nicht, was sie BEKOMMEN.
//
// Alle Stellschrauben stehen unter "marge" in config.json.

// Womit rechnet man den Verkauf?
//
// Der Median ist der Preis, den die Mitte des Marktes VERLANGT. Wer selbst
// verkaufen will, steht aber in derselben Liste wie alle anderen und muss
// unterbieten, sonst steht die Karte in drei Monaten noch da. Der realistische
// Erloes liegt deshalb im unteren Viertel der laufenden Angebote (p25) – das
// ist die Stelle, an der man schnell weg ist.
//
// realFaktor ist der Rest-Abschlag darauf: auch p25 ist noch ein Wunschpreis,
// verhandelt wird trotzdem. Mit p25 als Basis ist der Faktor nahe 1; auf dem
// Median waere er deutlich kleiner. Der wahre Wert steht im Flip-Buch, sobald
// genug echte Verkaeufe drin sind – bis dahin ist er eine begruendete Annahme
// und keine Messung.
export function erwarteterErloes(markt, cfg) {
  const m = cfg.marge || {};
  const mk = typeof markt === 'number' ? { ref: markt } : markt || {};

  const kaP25 = mk.p25 ?? mk.median ?? mk.ref;
  const kaMedian = mk.median ?? mk.ref;
  const ebayP25 = mk.ebay?.p25;

  // Ohne eBay-Daten: das untere Viertel des Kleinanzeigen-Marktes.
  if (!ebayP25) {
    if (!kaP25 || kaP25 <= 0) return null;
    return { erloes: kaP25 * (m.realFaktor ?? 0.95), basis: kaP25, basisArt: 'p25', woher: 'Kleinanzeigen' };
  }

  // Mit eBay-Daten: verkauft wird dort, also ist eBay der richtige Massstab –
  // ABER GEDECKELT auf den Kleinanzeigen-Median.
  //
  // Warum der Deckel: die Browse-API liefert LAUFENDE Angebote, keine
  // Abschluesse. Wucherangebote, die nie jemand kauft, stehen ewig online und
  // ziehen die Verteilung hoch. Gemessen am 11.08.2026 lag bei 9 von 18
  // Grafikkarten das eBay-p25 UEBER dem Neupreis – bei der RTX 5060 Ti
  // 621,75 € gegen 449 € neu. Ungedeckelt hat der Sniper daraus einen Fund mit
  // 134 € Gewinn gemacht, den es nicht gibt.
  //
  // Warum nicht einfach auf den Neupreis deckeln: das waere auch falsch. Eine
  // RTX 5090 wird real ueber UVP gehandelt (2329 € Liste, ~3850 € Markt) –
  // ein Neupreis-Deckel wuerde genau die Modelle kaputtrechnen, bei denen der
  // Gebrauchtmarkt ehrlich teurer ist.
  //
  // Der Kleinanzeigen-Median ist die bessere Grenze: breit erhoben, und er
  // bildet den echten Markt ab statt einer Liste. eBay darf die Schaetzung
  // also senken (Warnung ernst nehmen), aber nicht ueber das hinaus anheben,
  // was der Gebrauchtmarkt sonst hergibt.
  const gedeckelt = kaMedian ? Math.min(ebayP25, kaMedian) : ebayP25;
  if (!gedeckelt || gedeckelt <= 0) return null;

  return {
    erloes: gedeckelt * (m.realFaktor ?? 0.95),
    basis: gedeckelt,
    basisArt: 'p25',
    woher: gedeckelt < ebayP25 ? 'eBay, gedeckelt auf KA-Median' : 'eBay',
  };
}

// Was bleibt nach allen Kosten uebrig?
//
// km ist die einfache Entfernung – gerechnet wird mit Hin- UND Rueckweg.
// versand faellt nur an, wenn verschickt statt vor Ort uebergeben wird; im
// Zweifel wird er mitgerechnet, weil zu vorsichtig besser ist als zu optimistisch.
export function rechneMarge(einkauf, markt, km, cfg) {
  const m = cfg.marge || {};
  const e = erwarteterErloes(markt, cfg);
  if (!e || !einkauf || einkauf <= 0) return null;

  const gebuehr = e.erloes * ((m.gebuehrPct ?? 11) / 100);
  const versand = m.versandEuro ?? 0;
  const fahrt = (km ?? 0) * 2 * (m.kmKosten ?? 0);
  const netto = e.erloes - einkauf - gebuehr - versand - fahrt;

  return {
    erloes: r2(e.erloes),
    basis: r2(e.basis),
    basisArt: e.basisArt,
    woher: e.woher,
    gebuehr: r2(gebuehr),
    versand: r2(versand),
    fahrt: r2(fahrt),
    netto: r2(netto),
    // Verzinsung des eingesetzten Geldes, nicht Rabatt auf den Marktwert.
    // Das ist die Zahl, die zaehlt: 50 € Gewinn aus 100 € Einsatz ist ein
    // anderes Geschaeft als 50 € aus 2000 €, obwohl beide "50 € Gewinn" sind.
    pct: Math.round((netto / einkauf) * 100),
  };
}

// Lohnt sich die Fahrt? Beide Schwellen muessen halten.
//
// Nur Euro reicht nicht: 45 € aus 1800 € Einsatz sind 2,5 % und binden das
// ganze Kapital fuer Wochen. Nur Prozent reicht auch nicht: 40 % aus 30 €
// sind 12 € und keine Fahrt wert.
export function lohntSich(marge, cfg) {
  if (!marge) return false;
  const m = cfg.marge || {};
  return marge.netto >= (m.minEuro ?? 0) && marge.pct >= (m.minPct ?? 0);
}

// Eine Zeile fuer Discord: woher der Gewinn kommt, ohne Taschenrechner.
export function margeText(marge) {
  if (!marge) return 'Marge unbekannt – kein Marktwert vorhanden';
  const teile = [
    `Verkauf ~${e(marge.erloes)} (${marge.basisArt === 'p25' ? 'unteres Viertel' : 'Median'} ` +
      `${e(marge.basis)} auf ${marge.woher || 'Kleinanzeigen'})`,
    `Gebühr ${e(marge.gebuehr)}`,
  ];
  if (marge.versand) teile.push(`Versand ${e(marge.versand)}`);
  if (marge.fahrt) teile.push(`Fahrt ${e(marge.fahrt)}`);
  return (
    teile.join(' · ') +
    `\n**netto ${marge.netto >= 0 ? '+' : ''}${e(marge.netto)}** (${marge.pct} % auf den Einsatz)`
  );
}

const r2 = (n) => Math.round(n * 100) / 100;
const e = (n) => (n == null ? '–' : (+n).toFixed(2).replace('.', ',') + ' €');
