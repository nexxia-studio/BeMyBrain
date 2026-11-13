// Côtés de l'app (Privé / Pro), sans zod : importable par un composant client sans tirer zod dans le
// bundle (sa sonde `Function("")` déclenche une violation eval de la CSP de production).
export const sides = ["private", "pro"] as const;
export type Side = (typeof sides)[number];
