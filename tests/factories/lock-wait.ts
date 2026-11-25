import type { Pool } from "@neondatabase/serverless";

// Sonde de verrous pour les tests à deux connexions : dit si UNE connexion (pid) patiente sur un verrou.
// Lue par le propriétaire. Filtrée par pid : un autre fichier de test en parallèle ne donne pas de faux
// « bloqué ».

/** `advisory` = verrou consultatif (verrou d'ordre), `transactionid` = ligne tenue par une autre transaction. */
export type LockType = "advisory" | "transactionid";

/** Attend (5 s au plus) que la connexion `pid` patiente sur un verrou de ce type. */
export async function waitForLockWait(
  owner: Pool,
  pid: number,
  locktype: LockType,
): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await owner.query<{ waiting: number }>(
      `select count(*)::int as waiting from pg_locks
       where pid = $1 and locktype = $2 and not granted`,
      [pid, locktype],
    );
    if (rows[0]!.waiting > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}
