// Processus enfant de tests/db/pool-dead-after-freeze.test.ts (BRAIN-50). Lancé par `node --import tsx` :
// hors Vitest, mais le vrai pool (createPool) et le vrai withUserDb (createWithUserDb), comme src/db/client.ts.
// Seul le vérificateur de jeton est remplacé (pas de JWKS en test), comme dans pool-connection-loss.test.ts.
// Pas de `server-only` ici : client.ts n'est pas importé, on refait ses lignes (pool, createPooledDb, withUserDb
// avec evictIdle et poolName).
// Les alias `@/` de user-db.ts sont résolus par tsx (paths du tsconfig).
//
// Protocole (une ligne JSON par message sur stdout, jamais d'URL ni de message du pilote) :
// 1. chauffe 4 connexions (4 withUserDb parallèles, pg_sleep pour qu'elles soient distinctes) ;
//    → {"type":"ready","pids":[…]}
// 2. scrute le fichier déclencheur (argv[2]) par un minuteur court ; le parent le crée pendant le gel
//    (SIGSTOP), puis réveille (SIGCONT) : le minuteur en retard part avant le traitement des sockets,
//    comme une fonction Vercel qui reprend une requête ;
// 3. 4 lectures withUserDb parallèles → {"type":"result","outcomes":[…],"attempts","rawErrors","warnCount",
//    "readPids","poolTotal"}.
import { existsSync } from "node:fs";

import { sql } from "drizzle-orm";

import { createPool } from "../../src/db/pool";
import { createPooledDb } from "../../src/db/transaction-retry";
import { createWithUserDb } from "../../src/db/user-db";

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
/** Résultat d'une lecture réussie : le backend qui l'a servie. */
type Read = { outcome: Outcome; pid?: number };
/** Erreur brute du pilote vue sous withUserDb (qui la masque en DatabaseError) : classée, jamais recopiée. */
export type RawError = {
  connectionTerminated: boolean;
  code: string | undefined;
};
/** Preuve que le scénario a eu lieu, comptée pendant le réveil seulement (chauffe exclue). */
export type WakeTrace = {
  /** Appels à `db.transaction` (1 par lecture sans nouvelle tentative, 2 avec). */
  attempts: number;
  /** Échecs bruts de `db.transaction`, classés : 4 erreurs de connexion attendues après coupure. */
  rawErrors: RawError[];
  /** Lignes `console.warn` émises (contenu jamais renvoyé) : 1 par nouvelle tentative après la tâche 3. */
  warnCount: number;
  /** Backends qui ont servi les lectures réussies : aucun des backends tués attendu après coupure. */
  readPids: number[];
  /** Connexions que le pool garde à la fin (empruntées ou au repos) : les connexions mortes en sont sorties. */
  poolTotal: number;
};
export type ChildMessage =
  | { type: "ready"; pids: number[] }
  | ({ type: "result"; outcomes: Outcome[] } & WakeTrace);

const send = (message: ChildMessage) =>
  process.stdout.write(`${JSON.stringify(message)}\n`);

const pool = createPool(url, "app_backend");
// Comme client.ts : connexion prise et rendue par transaction, une connexion morte sort du pool.
const db = createPooledDb(pool);

// Compteurs remis à zéro au réveil : la chauffe ne compte pas.
type Counters = Pick<WakeTrace, "attempts" | "rawErrors" | "warnCount">;
let trace: Counters = { attempts: 0, rawErrors: [], warnCount: 0 };
// Seul le nombre de lignes compte ; leur contenu n'est ni affiché ni renvoyé.
console.warn = () => {
  trace.warnCount += 1;
};
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

// Point d'observation : chaque appel à `db.transaction`, donc chaque tentative, même rejouée. Voit l'erreur brute
// avant que withUserDb ne la remplace par DatabaseError (message du pilote perdu).
const observed: typeof db = {
  transaction: (callback) => {
    trace.attempts += 1;
    return db.transaction(callback).catch((error: unknown) => {
      const cause = (error as { cause?: unknown } | null)?.cause;
      trace.rawErrors.push({
        connectionTerminated: terminated(error) || terminated(cause),
        code: sqlState(error) ?? sqlState(cause),
      });
      throw error;
    });
  },
};

const withUserDb = createWithUserDb({
  verify: async () => ({ sub: USER_ID, role: "authenticated" }),
  db: observed,
  evictIdle: pool.evictIdle,
  poolName: "app_backend",
});

async function read(): Promise<Read> {
  try {
    const { rows } = await withUserDb("jeton", (tx) =>
      tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`),
    );
    return { outcome: { ok: true }, pid: Number(rows[0]?.pid) };
  } catch (error) {
    const { name, code } = error as { name?: unknown; code?: unknown };
    return {
      outcome: {
        ok: false,
        name: typeof name === "string" ? name : "inconnue",
        code: typeof code === "string" ? code : undefined,
      },
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
  trace = { attempts: 0, rawErrors: [], warnCount: 0 };
  void Promise.all(Array.from({ length: READS }, () => read())).then(
    async (reads) => {
      send({
        type: "result",
        outcomes: reads.map((r) => r.outcome),
        ...trace,
        readPids: reads.flatMap((r) => (r.pid === undefined ? [] : [r.pid])),
        poolTotal: pool.totalCount,
      });
      await pool.end();
    },
  );
}, 10);
