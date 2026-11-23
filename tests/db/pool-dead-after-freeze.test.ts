// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { Pool } from "@neondatabase/serverless";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import type { ChildMessage } from "../factories/frozen-pool-child.mts";

// BRAIN-50 : connexions du pool tuées pendant la pause d'une fonction Vercel, prêtées au réveil.
// L'enfant (vrai createPool + createWithUserDb) chauffe 4 connexions ; le test le gèle (SIGSTOP = pause
// Vercel), tue ses backends côté serveur (pg_terminate_backend depuis une connexion app_backend séparée :
// même effet que la mise en veille du compute Neon, sans API Neon), puis le réveille (SIGCONT) en
// déclenchant aussitôt 4 lectures parallèles. Branche Neon test uniquement.

const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!backendUrl) {
  throw new Error(
    "tests/db/pool-dead-after-freeze.test.ts : DATABASE_TEST_AUTHENTICATED_URL requise (branche Neon test). Voir .env.example.",
  );
}

/**
 * Endpoint direct (sans -pooler), comme tests/db/app-backend.test.ts : une connexion = un backend Postgres, donc
 * tuer un backend ferme le socket du client, comme la mise en veille du compute. Derrière le pooler (mode
 * transaction), les backends sont partagés : le tueur peut tomber sur un backend qu'il tue lui-même, et tuer un
 * backend au repos ne ferme pas les connexions clientes du pooler.
 */
function directUrl(url: string): string {
  const direct = new URL(url);
  direct.hostname = direct.hostname.replace(/^([^.]+)-pooler\./, "$1.");
  return direct.toString();
}
const directBackendUrl = directUrl(backendUrl);

const CHILD = join(import.meta.dirname, "../factories/frozen-pool-child.mts");
// Neon froid : ~1 s de réveil du compute, plus le démarrage de tsx.
const TIMEOUT = 30_000;

const killer = new Pool({ connectionString: directBackendUrl, max: 1 });
// Une erreur du pilote porte son client (hôte, mot de passe) : jamais remontée telle quelle à Vitest.
killer.on("error", () => undefined);
const dir = mkdtempSync(join(tmpdir(), "brain-50-"));
let child: ChildProcess | undefined;

afterEach(() => {
  // SIGKILL agit aussi sur un processus gelé par SIGSTOP.
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
  child = undefined;
});

afterAll(async () => {
  await killer.end();
  rmSync(dir, { recursive: true, force: true });
});

/** Lance l'enfant ; `next()` rend son prochain message JSON. */
function startChild(trigger: string) {
  const proc = spawn(process.execPath, ["--import", "tsx", CHILD, trigger], {
    cwd: join(import.meta.dirname, "../.."),
    // Seules variables transmises : de quoi trouver node, et l'URL visée (NODE_ENV exigé par le type de Next).
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      FROZEN_POOL_URL: directBackendUrl,
    },
    // stderr ignoré : un message du pilote n'a rien à faire dans les journaux de test.
    stdio: ["ignore", "pipe", "ignore"],
  });
  child = proc;
  const lines = createInterface({ input: proc.stdout! })[
    Symbol.asyncIterator
  ]();
  return {
    proc,
    async next(): Promise<ChildMessage> {
      const { value, done } = await lines.next();
      if (done) throw new Error("L'enfant s'est arrêté sans répondre.");
      return JSON.parse(value) as ChildMessage;
    },
  };
}

async function freezeAndWake(options: { terminate: boolean }) {
  const trigger = join(dir, `trigger-${options.terminate}-${Date.now()}`);
  const { proc, next } = startChild(trigger);
  const ready = await next();
  if (ready.type !== "ready") throw new Error("Message « ready » attendu.");
  expect(new Set(ready.pids).size).toBe(4);

  proc.kill("SIGSTOP");
  if (options.terminate) {
    const { rows } = await killer
      .query<{ ok: boolean }>(
        "select pg_terminate_backend(pid) as ok from unnest($1::int[]) as pid",
        [ready.pids],
      )
      .catch((error: { code?: string }) => {
        throw new Error(`pg_terminate_backend en échec (${error.code})`);
      });
    expect(rows.map((row) => row.ok)).toEqual([true, true, true, true]);
  }
  // Laisse au serveur le temps de fermer les sockets ; l'enfant, gelé, ne les traite pas.
  await new Promise((resolve) => setTimeout(resolve, 500));
  writeFileSync(trigger, "");
  proc.kill("SIGCONT");

  const result = await next();
  if (result.type !== "result") throw new Error("Message « result » attendu.");
  return result;
}

describe("pool gelé puis réveillé (BRAIN-50)", () => {
  it(
    "témoin : sans coupure pendant le gel, les 4 lectures du réveil réussissent",
    async () => {
      const result = await freezeAndWake({ terminate: false });

      expect(result.outcomes).toEqual([
        { ok: true },
        { ok: true },
        { ok: true },
        { ok: true },
      ]);
    },
    TIMEOUT,
  );

  // Rouge sur le code actuel (constaté le 2026-11-23, 4 runs sur 4) : 4 DatabaseError 57P01. Le serveur a
  // envoyé « terminating connection due to administrator command » avant de fermer ; le pool, réveillé, prête
  // les 4 connexions avant de traiter ces messages. Avec la veille Neon (sans message), même mécanisme mais
  // « Connection terminated unexpectedly » sans SQLSTATE. Deux erreurs de connexion au sens de la spec.
  // Rendu vert par la tâche 3 (BRAIN-50) : passer alors `it.fails` en `it`.
  it.fails(
    "connexions tuées pendant le gel : les 4 lectures parallèles du réveil réussissent",
    async () => {
      const result = await freezeAndWake({ terminate: true });

      expect(result.outcomes).toEqual([
        { ok: true },
        { ok: true },
        { ok: true },
        { ok: true },
      ]);
    },
    TIMEOUT,
  );
});
