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
  const exited = new Promise<string>((resolve) =>
    proc.once("exit", (code, signal) =>
      resolve(`code ${code ?? "aucun"}, signal ${signal ?? "aucun"}`),
    ),
  );
  const lines = createInterface({ input: proc.stdout! })[
    Symbol.asyncIterator
  ]();
  return {
    proc,
    async next(): Promise<ChildMessage> {
      const { value, done } = await lines.next();
      // stdout fermé : l'enfant est mort (au démarrage, ou pendant la chauffe). Son stderr n'est jamais affiché.
      if (done)
        throw new Error(
          `L'enfant s'est arrêté sans répondre (${await exited}). Relancer à la main : node --import tsx tests/factories/frozen-pool-child.mts <déclencheur>.`,
        );
      return JSON.parse(value) as ChildMessage;
    },
  };
}

const BACKENDS_GONE_LIMIT_MS = 5_000;

/** Nombre des `pids` encore présents dans pg_stat_activity. */
async function countBackends(pids: number[]): Promise<number> {
  const { rows } = await killer
    .query<{ n: number }>(
      "select count(*)::int as n from pg_stat_activity where pid = any($1::int[])",
      [pids],
    )
    .catch((error: { code?: string }) => {
      throw new Error(`lecture de pg_stat_activity en échec (${error.code})`);
    });
  return rows[0]?.n ?? -1;
}

/** Interroge pg_stat_activity jusqu'à ce qu'aucun des `pids` n'y figure ; échoue au-delà du plafond. */
async function waitForBackendsGone(pids: number[]) {
  const deadline = Date.now() + BACKENDS_GONE_LIMIT_MS;
  for (;;) {
    const remaining = await countBackends(pids);
    if (remaining === 0) return;
    if (Date.now() > deadline) {
      throw new Error(
        `${remaining} backend(s) encore présents après ${BACKENDS_GONE_LIMIT_MS} ms.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
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
    // Attend que les backends aient disparu côté serveur (sockets fermés) ; l'enfant, gelé, ne le sait pas.
    await waitForBackendsGone(ready.pids);
  } else {
    // Témoin : les 4 connexions de l'enfant sont toujours vivantes pendant le gel.
    expect(await countBackends(ready.pids)).toBe(4);
  }
  writeFileSync(trigger, "");
  proc.kill("SIGCONT");

  const result = await next();
  if (result.type !== "result") throw new Error("Message « result » attendu.");
  return { result, warmPids: ready.pids };
}

describe("pool gelé puis réveillé (BRAIN-50)", () => {
  it(
    "témoin : sans coupure pendant le gel, les 4 lectures du réveil réussissent sur les connexions chauffées",
    async () => {
      const { result, warmPids } = await freezeAndWake({ terminate: false });

      expect(result.outcomes).toEqual([
        { ok: true },
        { ok: true },
        { ok: true },
        { ok: true },
      ]);
      expect(result).toMatchObject({
        attempts: 4,
        rawErrors: [],
        warnCount: 0,
        poolTotal: 4,
      });
      for (const pid of result.readPids) expect(warmPids).toContain(pid);
    },
    TIMEOUT,
  );

  // Avant le correctif (constaté le 2026-11-23) : le pool, réveillé, prêtait les 4 connexions mortes avant de
  // traiter leur fermeture → 4 DatabaseError. pg_terminate_backend envoie un FATAL 57P01 avant de fermer ; la
  // veille Neon ferme sans message (« Connection terminated unexpectedly », sans SQLSTATE) : deux erreurs de
  // connexion au sens de la spec. Preuves exigées (un vert seul ne prouve rien, l'ordre de la boucle
  // d'événements peut varier) : chaque lecture a échoué une fois sur une connexion morte (4 erreurs brutes de
  // connexion), a été rejouée une fois (8 essais, 4 traces), a réussi sur un backend neuf, et les connexions
  // mortes sont sorties du pool (4 connexions restantes, pas 8).
  it(
    "connexions tuées pendant le gel : chaque lecture du réveil est rejouée une fois sur une connexion neuve et réussit",
    async () => {
      const { result, warmPids } = await freezeAndWake({ terminate: true });

      expect(result.outcomes).toEqual([
        { ok: true },
        { ok: true },
        { ok: true },
        { ok: true },
      ]);
      expect(result.attempts).toBe(8);
      expect(result.rawErrors).toHaveLength(4);
      for (const raw of result.rawErrors) {
        expect(raw.code === "57P01" || raw.connectionTerminated).toBe(true);
      }
      expect(result.warnCount).toBe(4);
      expect(result.readPids).toHaveLength(4);
      for (const pid of result.readPids) expect(warmPids).not.toContain(pid);
      expect(result.poolTotal).toBeLessThanOrEqual(4);
    },
    TIMEOUT,
  );
});
