// Seule source du fuseau de l'utilisateur (spec todo-unifiee) : « aujourd'hui » et le formatage next-intl
// en dépendent. Sans dépendance serveur : importable côté client (mêmes dates rendues des deux côtés).
// Verrou : tests/i18n/time-zone-single-source.test.ts (aucun autre fichier de src/ n'écrit un fuseau).

// raccourci: fuseau fixe pour l'unique compte de la tranche 1 — lire la préférence de l'utilisateur avec le multi-comptes (BRAIN-26).
export function getUserTimeZone(): string {
  return "Europe/Brussels";
}

/** Jour calendaire de `now` dans `timeZone`, au format `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
