/**
 * Erreur métier levée par un module (src/modules/<module>/) : traverse withUserDb sans être masquée
 * en DatabaseError, et peut être interceptée par l'UI (qui n'a pas accès à @/db).
 * `code` est un identifiant stable, traduit côté UI ; le message vaut le code : jamais de donnée
 * utilisateur, de valeur liée ni de cause chaînée dedans.
 */
export class DomainError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = new.target.name;
    this.code = code;
  }
}
