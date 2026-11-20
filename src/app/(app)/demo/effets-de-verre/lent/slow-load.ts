// Chargement ralenti des routes `lent/` de la démo (BRAIN-33, essai iPhone) : laisse le temps de voir le givre
// du vrai `loading.tsx` avant la vraie page.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre (demo-access.ts).

export const SLOW_LOAD_MS = 3000;

export function waitSlowLoad(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SLOW_LOAD_MS));
}
