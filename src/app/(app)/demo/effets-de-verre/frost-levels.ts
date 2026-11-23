// Crans d'intensité du givre pour l'essai iPhone (QA-1) : mêmes variables que les défauts de `:root` dans
// globals.css (cran discret), surchargées par héritage sur l'enveloppe du layout de la démo. Couleurs tirées
// des seuls tokens de la charte (halos, primaire). Aucun zod : importé aussi par le réglage côté client.
// raccourci: réglage de démo, retiré avec la démo à la tâche 9 du plan effets-de-verre (cookie compris).

export const FROST_LEVEL_COOKIE = "glass-demo-frost";
export const FROST_LEVEL_COOKIE_PATH = "/demo/effets-de-verre";

export const FROST_LEVELS = ["subtle", "medium", "strong"] as const;
export type FrostLevel = (typeof FROST_LEVELS)[number];

type FrostVars = {
  "--frost-from": string;
  "--frost-to": string;
  "--frost-rest": string;
};

function tinted(percent: number): Omit<FrostVars, "--frost-rest"> {
  return {
    "--frost-from": `color-mix(in srgb, var(--halo-blue), var(--primary) ${percent}%)`,
    "--frost-to": `color-mix(in srgb, var(--halo-lilac), var(--primary) ${percent}%)`,
  };
}

export const FROST_LEVEL_VARS: Record<FrostLevel, FrostVars> = {
  subtle: {
    "--frost-from": "var(--halo-blue)",
    "--frost-to": "var(--halo-lilac)",
    "--frost-rest": "0.55",
  },
  medium: { ...tinted(15), "--frost-rest": "0.6" },
  strong: { ...tinted(30), "--frost-rest": "0.65" },
};

/** Cran lu dans le cookie : toute valeur hors liste (ou absente) donne le cran discret, celui de l'app. */
export function parseFrostLevel(value: string | undefined): FrostLevel {
  return FROST_LEVELS.find((level) => level === value) ?? "subtle";
}
