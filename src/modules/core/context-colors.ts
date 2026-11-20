// Couleurs d'espace (contexts.color, drizzle/0007), sans zod : importable par un composant client sans
// tirer zod dans le bundle (sa sonde `Function("")` déclenche une violation eval de la CSP de production).
// Les trois pastilles de DESIGN.md (`chip-neutral`, `chip-warm`, `chip-indigo`) ; jamais saisie.
export const contextColors = ["neutral", "warm", "indigo"] as const;
export type ContextColor = (typeof contextColors)[number];

/** Espace tel que l'interface le propose : nom saisi (jamais traduit) et couleur de sa pastille. */
export type ContextOption = { id: string; name: string; color: ContextColor };
