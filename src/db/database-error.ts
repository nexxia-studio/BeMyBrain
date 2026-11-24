// Erreur masquée de la base et lecture du SQLSTATE, partagées par user-db.ts et connection-lost.ts
// (fichier à part : connection-lost.ts n'importe pas user-db.ts, qui l'utilisera, pas de cycle).

/**
 * Échec d'une requête dans withUserDb. Message fixe, sans cause chaînée ni `query` / `params`
 * (Drizzle y met les valeurs liées, dont les claims) : on ne garde que le SQLSTATE.
 */
export class DatabaseError extends Error {
  readonly code: string | undefined;
  constructor(code?: string) {
    super("Erreur de base de données");
    this.name = "DatabaseError";
    this.code = code;
  }
}

const SQLSTATE = /^[0-9A-Z]{5}$/;

function sqlStateCodeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && SQLSTATE.test(code) ? code : undefined;
}

/** SQLSTATE de l'erreur, ou de sa cause : Drizzle enveloppe l'erreur du pilote. */
export function sqlStateOf(error: unknown): string | undefined {
  return (
    sqlStateCodeOf(error) ??
    sqlStateCodeOf((error as { cause?: unknown } | null)?.cause)
  );
}
