// Processus enfant de tests/db/pool-dead-after-freeze.test.ts (BRAIN-50). Lancé par `node --import tsx` :
// hors Vitest, mais le vrai pool (createPool) et le vrai withUserDb (createWithUserDb), comme src/db/client.ts.
// Seul le vérificateur de jeton est remplacé (pas de JWKS en test), comme dans pool-connection-loss.test.ts.
// Pas de `server-only` ici : client.ts n'est pas importé, on refait ses trois lignes (pool, drizzle, withUserDb).
// Les alias `@/` de user-db.ts sont résolus par tsx (paths du tsconfig).
//
// Protocole (une ligne JSON par message sur stdout, jamais d'URL ni de message du pilote) :
// 1. chauffe 4 connexions (4 withUserDb parallèles, pg_sleep pour qu'elles soient distinctes) ;
//    → {"type":"ready","pids":[…]}
// 2. scrute le fichier déclencheur (argv[2]) par un minuteur court ; le parent le crée pendant le gel
//    (SIGSTOP), puis réveille (SIGCONT) : le minuteur en retard part avant le traitement des sockets,
//    comme une fonction Vercel qui reprend une requête ;
// 3. 4 lectures withUserDb parallèles → {"type":"result","outcomes":[…],"rawErrors":[…]}.
import { existsSync } from "node:fs";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import { createPool } from "../../src/db/pool";
import { createWithUserDb, type UserDb } from "../../src/db/user-db";

const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const READS = 4;

// URL app_backend de la branche test, endpoint direct, posée par le test parent (seule variable transmise).
const url = process.env.FROZEN_POOL_URL;
const trigger = process.argv[2];
if (!url || !trigger) {
  throw new Error(
    "frozen-pool-child : FROZEN_POOL_URL et le chemin du déclencheur sont requis.",
  );
}

export type Outcome =
  { ok: true } | { ok: false; name: string; code: string | undefined };
/** Erreur brute du pilote vue sous withUserDb (qui la masque en DatabaseError) : classée, jamais recopiée. */
export type RawError = {
  connectionTerminated: boolean;
  code: string | undefined;
};
export type ChildMessage =
  | { type: "ready"; pids: number[] }
  | { type: "result"; outcomes: Outcome[]; rawErrors: RawError[] };

const send = (message: ChildMessage) =>
  process.stdout.write(`${JSON.stringify(message)}\n`);

const pool = createPool(url, "app_backend");
const db = drizzle({ client: pool });

const rawErrors: RawError[] = [];
const sqlState = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)
    ? code
    : undefined;
};
const terminated = (error: unknown) =>
  /^Connection terminated/.test(
    String((error as { message?: unknown } | null)?.message),
  );

// Observe l'erreur brute avant que withUserDb ne la remplace par DatabaseError (message du pilote perdu).
const observed: Pick<UserDb, "transaction"> = {
  transaction: ((...args: Parameters<UserDb["transaction"]>) =>
    db.transaction(...args).catch((error: unknown) => {
      const cause = (error as { cause?: unknown } | null)?.cause;
      rawErrors.push({
        connectionTerminated: terminated(error) || terminated(cause),
        code: sqlState(error) ?? sqlState(cause),
      });
      throw error;
    })) as UserDb["transaction"],
};

const withUserDb = createWithUserDb({
  verify: async () => ({ sub: USER_ID, role: "authenticated" }),
  db: observed,
});

async function read(query: ReturnType<typeof sql>): Promise<Outcome> {
  try {
    await withUserDb("jeton", (tx) => tx.execute(query));
    return { ok: true };
  } catch (error) {
    const { name, code } = error as { name?: unknown; code?: unknown };
    return {
      ok: false,
      name: typeof name === "string" ? name : "inconnue",
      code: typeof code === "string" ? code : undefined,
    };
  }
}

// Chauffe : 4 transactions simultanées → 4 connexions distinctes, laissées au repos dans le pool.
const pids = await Promise.all(
  Array.from({ length: READS }, () =>
    withUserDb("jeton", async (tx) => {
      const { rows } = await tx.execute<{ pid: number }>(
        sql`select pg_backend_pid() as pid, pg_sleep(0.2)`,
      );
      return Number(rows[0]?.pid);
    }),
  ),
);
send({ type: "ready", pids });

const poll = setInterval(() => {
  if (!existsSync(trigger)) return;
  clearInterval(poll);
  void Promise.all(
    Array.from({ length: READS }, () => read(sql`select 1 as one`)),
  ).then(async (outcomes) => {
    send({ type: "result", outcomes, rawErrors });
    await pool.end();
  });
}, 10);
