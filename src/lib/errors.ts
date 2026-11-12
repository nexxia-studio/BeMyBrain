const CODE_FORMAT = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Erreur métier levée par un module (src/modules/<module>/) : traverse withUserDb sans être masquée
 * en DatabaseError, et peut être interceptée par l'UI (qui n'a pas accès à @/db).
 * `code` est un identifiant stable, traduit côté UI ; le message vaut le code : jamais de donnée
 * utilisateur, de valeur liée ni de cause chaînée dedans.
 * Abstraite : chaque module la dérive (ex. CoreError) et fixe `name` en dur (la minification renomme
 * les classes). L'UI ne s'appuie que sur `code` et `instanceof`, jamais sur `name` ni `message`.
 */
export abstract class DomainError extends Error {
  readonly code: string;
  // Un seul paramètre : ni cause, ni champ libre. Un code hors format (ex. avec une valeur
  // utilisateur concaténée) est remplacé, pour qu'aucune donnée ne traverse withUserDb.
  constructor(code: string) {
    const safe = CODE_FORMAT.test(code) ? code : "invalid_error_code";
    super(safe);
    this.code = safe;
  }
}
