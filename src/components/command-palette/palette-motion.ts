// Durées de la palette (DESIGN.md § 7) : ouverture 0,2 s, fermeture 0,15 s ; en mouvement réduit,
// fondus de 0,15 s au plus.
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function paletteDurations(reducedMotion: boolean) {
  return reducedMotion
    ? { enter: 0.15, exit: 0.15 }
    : { enter: 0.2, exit: 0.15 };
}
