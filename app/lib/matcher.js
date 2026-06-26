// matcher.js – Kern des Sealed-Produkt-Matchings für CardPulse BI.

const STOP = new Set([
  "pokemon","pokémon","tcg","trading","card","game","the","of","and","x",
  "english","englisch","en","deutsch","de","french","fr","sealed","neu","new",
  "original","ovp","produkt","product","set","pcs","stück","stk","display",
]);

const TYPE_RULES = [
  ["etb-case",        /elite trainer box case|etb case/],
  ["booster-box-case",/booster box case/],
  ["booster-box",     /booster box|booster display|booster bundle|display|36er|36 pack/],
  ["etb",             /elite trainer box|\betb\b/],
  ["checklane",       /checklane|check ?lane/],
  ["blister",         /blister|3 ?pack|3er|drei ?pack/],
  ["tin",             /\btin\b|dose/],
  ["collection",      /collection|kollektion|premium collection/],
  ["bundle",          /bundle|pack bundle/],
  ["booster",         /booster|pack/],
];

const ABBREV = [
  [/\bu\.?p\.?c\.?\b/gi, "ultra premium collection"],
  [/\betb\b/gi, "elite trainer box"],
  [/\bbb\b/gi, "booster box"],
  [/\bbd\b/gi, "booster box"],
  [/\bsv\b/gi, "scarlet violet"],
  [/\bpri\s*evo\b/gi, "prismatic evolutions"],
  [/\bpre\b/gi, "prismatic evolutions"],
  [/\b1st chapter\b/gi, "the first chapter"],
  [/\bdisplay\b/gi, "booster box"],
];

function expandAbbrev(name) {
  let s = " " + (name || "") + " ";
  for (const [rx, full] of ABBREV) s = s.replace(rx, " " + full + " ");
  return s.trim();
}

function classifyType(name) {
  const n = expandAbbrev(name).toLowerCase();
  for (const [type, rx] of TYPE_RULES) if (rx.test(n)) return type;
  return null;
}

function tokenize(name) {
  return expandAbbrev(name || "")
    .toLowerCase()
    .normalize("NFD")                    
    .replace(/[\u0300-\u036f]/g, "")     
   .replace(/[()[\]{}]/g, " ")
    .replace(/[^a-z0-9äöüß\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[m][n];
}

function wordsMatch(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 4) return a === b;
  return lev(a, b) <= 1;
}

function tokenOverlap(queryTokens, candTokens) {
  if (queryTokens.length === 0) return 0;
  let hits = 0;
  for (const q of queryTokens) {
    if (candTokens.some((c) => wordsMatch(q, c))) hits++;
  }
  return hits / queryTokens.length;
}

export function matchProduct(shopName, catalog) {
  const qTokens = tokenize(shopName);
  const qType = classifyType(shopName);

  let best = null;
  for (const cand of catalog) {
    const cTokens = tokenize(cand.name);
    const cType = classifyType(cand.name);
    const fwd = tokenOverlap(qTokens, cTokens);
    const bwd = tokenOverlap(cTokens, qTokens);
    const overlap = (fwd + bwd) / 2;
    let typeFactor = 1;
    if (qType && cType) typeFactor = (qType === cType) ? 1.1 : 0.55;
    const score = Math.min(1, overlap * typeFactor);
    if (!best || score > best.score) best = { cand, score };
  }

 const confidence = best ? Math.round(best.score * 100) : 0;
  // Unter 40 % ist der "beste" Treffer praktisch wertlos – dann lieber
  // gar keinen anzeigen, statt einen sinnlosen Vorschlag zu machen.
  if (!best || confidence < 40) {
    return { match: null, confidence };
  }
  return { match: best.cand, confidence };
}