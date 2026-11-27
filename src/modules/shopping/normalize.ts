// Normalisation d'un libellé de courses (spec « Classement », étapes 1 à 3).
// Fonction pure, partagée par la correction mémorisée et le dictionnaire.

const UNITS = new Set(["g", "kg", "l", "cl", "ml", "pce", "pcs", "boite", "boites", "paquet", "paquets"]);
const FILLERS = new Set(["de", "d", "du", "of"]);

const isNumber = (t: string) => /^\d+(_\d+)?x?$/.test(t) || /^x\d+$/.test(t) || t === "x";
const isPureNumber = (t: string) => /^\d+(_\d+)?$/.test(t);

export type NormalizedLabel = {
  /** Libellé tel que saisi (espaces de bord retirés). */
  display: string;
  /** Texte normalisé, quantité retirée : clé d'une correction mémorisée. */
  normalized: string;
  /** Mots du texte normalisé. */
  words: string[];
  /** Formes à essayer pour une expression : telle quelle, puis sans `s`/`x` final. */
  forms: string[];
};

/** Un terme tel quel, puis sans `s`/`x` final (ni pour un mot de deux lettres ou moins). */
export function singularForms(term: string): string[] {
  return term.length > 3 && /[sx]$/.test(term) ? [term, term.slice(0, -1)] : [term];
}

function stripQuantity(tokens: string[]): string[] {
  let t = [...tokens];
  // En tête : nombre(s), puis unité (seulement après un nombre), puis « de ».
  let sawNumber = false;
  while (t.length > 1 && isNumber(t[0])) {
    sawNumber ||= isPureNumber(t[0]) || t[0] !== "x";
    t.shift();
  }
  if (sawNumber) {
    if (t.length > 1 && UNITS.has(t[0])) t.shift();
    if (t.length > 1 && FILLERS.has(t[0])) t.shift();
  }
  // En queue : nombre(s), avec l'unité qui les suit.
  for (;;) {
    const last = t.at(-1);
    const prev = t.at(-2);
    if (t.length > 2 && last !== undefined && UNITS.has(last) && prev !== undefined && isPureNumber(prev)) {
      t = t.slice(0, -2);
    } else if (t.length > 1 && last !== undefined && isNumber(last)) {
      t.pop();
    } else break;
  }
  return t;
}

export function normalizeLabel(label: string): NormalizedLabel {
  const display = label.trim();
  const tokens = display
    .toLowerCase()
    .replace(/œ/g, "oe") // les ligatures ne sont pas décomposées par NFD
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/(\d)[.,](\d)/g, "$1_$2")
    .replace(/[^\p{L}\p{N}_]+/gu, " ")
    .split(" ")
    .filter(Boolean);
  const words = stripQuantity(tokens);
  const normalized = words.join(" ");
  return { display, normalized, words, forms: normalized ? singularForms(normalized) : [] };
}
