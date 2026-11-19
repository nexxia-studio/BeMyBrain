import type { Pool, PoolClient } from "@neondatabase/serverless";

// Transaction app_backend toujours annulée, claims posés à la main (aucun filtre applicatif) : les
// écritures réussies d'un test ne fuient pas dans les suivants. Pour les tests de RLS en SQL direct ;
// as-user.ts, lui, passe par le vrai withUserDb et valide ses transactions.

export type AsUser = <T>(
  sub: string | null,
  run: (db: PoolClient) => Promise<T>,
) => Promise<T>;

export function createAsUser(backend: Pool): AsUser {
  return async (sub, run) => {
    const client = await backend.connect();
    try {
      await client.query("begin");
      // Comme withUserDb : charger pg_session_jwt avant set_config, sinon un backend neuf perd les claims.
      await client.query("select app.current_user_id()");
      if (sub) {
        await client.query(
          "select set_config('request.jwt.claims', $1, true)",
          [JSON.stringify({ sub, role: "authenticated" })],
        );
      }
      return await run(client);
    } finally {
      await client.query("rollback").catch(() => undefined);
      client.release();
    }
  };
}
