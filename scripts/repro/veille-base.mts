// Reproduction BRAIN-50 : connexions du pool coupées pendant la pause d'une fonction Vercel, prêtées au réveil.
// Procédure et lecture du verdict : docs/runbooks/veille-base.md.
//
//   node --import tsx scripts/repro/veille-base.mts [--terminate|--suspend] [--branch test|dev]
//
// L'enfant est celui du test automatisé (tests/factories/frozen-pool-child.mts) : vrai createPool, vrai
// createPooledDb et vrai createWithUserDb, seul le vérificateur de jeton est remplacé. Il chauffe 4 connexions ;
// ce script le gèle (SIGSTOP = pause Vercel), coupe ses connexions, puis le réveille (SIGCONT) en déclenchant
// aussitôt 4 lectures parallèles, comme le tableau de bord.
// - --terminate (défaut) : pg_terminate_backend des 4 backends de l'enfant, depuis une connexion séparée.
// - --suspend : mise en veille du compute par l'API Neon (NEON_API_KEY, NEON_PROJECT_ID, NEON_ENDPOINT_ID), comme
//   la veille réelle. Coupe aussi toute autre connexion à cette branche (tests lancés en parallèle compris).
//
// Rien de secret n'est affiché : ni URL, ni hôte, ni clé, ni identifiant Neon, ni message ou objet d'erreur du
// pilote (une erreur du pilote porte son client, mot de passe compris). Erreurs réduites à nom + SQLSTATE.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  hostOfUrl,
  isTrustedPlatform,
  parseHostVariable,
} from "../neon-host.mjs";
import type { ChildMessage } from "../../tests/factories/frozen-pool-child.mts";

type Env = Record<string, string | undefined>;
export type Mode = "terminate" | "suspend";
export type Branch = "test" | "dev";
export type SuspendConfig = {
  apiKey: string;
  projectId: string;
  endpointId: string;
};

const USAGE =
  "Usage : node --import tsx scripts/repro/veille-base.mts [--terminate|--suspend] [--branch test|dev]";

/** Erreur du script lui-même : son message ne contient que des noms de variables, affiché tel quel. */
class ReproError extends Error {}

export function parseArgs(argv: string[]): { mode: Mode; branch: Branch } {
  const modes = new Set<Mode>();
  let branch: Branch = "test";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--terminate") modes.add("terminate");
    else if (arg === "--suspend") modes.add("suspend");
    else if (arg === "--branch") {
      const value = argv[(i += 1)];
      if (value !== "test" && value !== "dev") {
        throw new ReproError(`--branch attend test ou dev. ${USAGE}`);
      }
      branch = value;
    } else throw new ReproError(`Argument inconnu. ${USAGE}`);
  }
  if (modes.size > 1) {
    throw new ReproError(
      `--terminate et --suspend s'excluent : choisir l'un des deux. ${USAGE}`,
    );
  }
  return { mode: [...modes][0] ?? "terminate", branch };
}

const URL_VARIABLE: Record<Branch, string> = {
  test: "DATABASE_TEST_AUTHENTICATED_URL",
  dev: "DATABASE_AUTHENTICATED_URL",
};

/**
 * URL app_backend de la branche visée, réécrite vers l'endpoint direct (sans -pooler) : une connexion = un
 * backend Postgres, donc tuer un backend ferme le socket du client (piège du pooler : tests/db/app-backend).
 * Refuse la production (NEON_PRODUCTION_HOST obligatoire) et toute exécution hors poste local.
 */
export function resolveTarget(env: Env, branch: Branch): string {
  if (isTrustedPlatform(env)) {
    throw new ReproError(
      "Script de reproduction réservé au poste local : refusé sur GitHub Actions et Vercel.",
    );
  }
  const name = URL_VARIABLE[branch];
  const url = env[name];
  if (!url) {
    throw new ReproError(
      `${name} manquante (branche ${branch}). Voir .env.example.`,
    );
  }
  const productionHost = env.NEON_PRODUCTION_HOST;
  if (!productionHost) {
    throw new ReproError(
      "NEON_PRODUCTION_HOST manquante : obligatoire pour empêcher une reproduction sur la production. Voir .env.example.",
    );
  }
  const production = parseHostVariable(productionHost, "NEON_PRODUCTION_HOST");
  const host = hostOfUrl(url, name);
  if (host === production) {
    throw new ReproError(
      `${name} vise NEON_PRODUCTION_HOST : reproduction sur la production refusée.`,
    );
  }
  const direct = new URL(url);
  direct.hostname = host;
  return direct.toString();
}

/**
 * Configuration de l'API Neon pour --suspend. NEON_ENDPOINT_ID doit être l'endpoint de la branche visée (premier
 * segment de son hôte) : jamais de mise en veille d'un autre compute, la production en tête.
 */
export function resolveSuspendConfig(
  env: Env,
  targetUrl: string,
): SuspendConfig {
  const names = ["NEON_API_KEY", "NEON_PROJECT_ID", "NEON_ENDPOINT_ID"];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new ReproError(
      `--suspend : variable(s) manquante(s) : ${missing.join(", ")}. À poser dans l'environnement, jamais dans un fichier versionné.`,
    );
  }
  const endpointId = env.NEON_ENDPOINT_ID!.trim().toLowerCase();
  const targetEndpoint = hostOfUrl(targetUrl, "cible").split(".")[0];
  if (endpointId !== targetEndpoint) {
    throw new ReproError(
      "NEON_ENDPOINT_ID n'est pas l'endpoint de la branche visée par --branch : mise en veille refusée.",
    );
  }
  return {
    apiKey: env.NEON_API_KEY!.trim(),
    projectId: env.NEON_PROJECT_ID!.trim(),
    endpointId,
  };
}

/** Erreur réduite à ce qui peut s'afficher : message du script, ou nom + SQLSTATE d'une erreur tierce. */
function describe(error: unknown): string {
  if (error instanceof ReproError) return error.message;
  const { name, code } = (error ?? {}) as { name?: unknown; code?: unknown };
  const label = typeof name === "string" ? name : "Erreur";
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)
    ? `${label} (${code})`
    : label;
}

const ROOT = join(import.meta.dirname, "../..");
const CHILD = join(ROOT, "tests/factories/frozen-pool-child.mts");
const LIMIT_MS = 30_000;
const NEON_API = "https://console.neon.tech/api/v2";

const elapsed = (since: number) => `${Math.round(performance.now() - since)} ms`;

async function neonCall(
  config: SuspendConfig,
  path: string,
  method: "GET" | "POST",
): Promise<unknown> {
  const response = await fetch(
    `${NEON_API}/projects/${encodeURIComponent(config.projectId)}/endpoints/${encodeURIComponent(config.endpointId)}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  ).catch((error: unknown) => {
    throw new ReproError(`API Neon injoignable (${describe(error)}).`);
  });
  if (!response.ok) {
    throw new ReproError(
      `API Neon : réponse HTTP ${response.status} (${method} endpoint${path}).`,
    );
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : null;
}

/** Met le compute en veille, puis attend qu'il soit à l'arrêt : ses connexions sont alors fermées. */
async function suspendCompute(config: SuspendConfig): Promise<string> {
  const start = performance.now();
  await neonCall(config, "/suspend", "POST");
  for (;;) {
    const body = (await neonCall(config, "", "GET")) as {
      endpoint?: { current_state?: unknown };
    } | null;
    if (body?.endpoint?.current_state === "idle") {
      return `compute mis en veille (API Neon), à l'arrêt après ${elapsed(start)}`;
    }
    if (performance.now() - start > LIMIT_MS) {
      throw new ReproError(
        `Compute toujours actif ${LIMIT_MS} ms après la demande de mise en veille.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Tue les backends de l'enfant depuis une connexion séparée, puis attend leur disparition côté serveur. */
async function terminateBackends(
  targetUrl: string,
  pids: number[],
): Promise<string> {
  // Import tardif : les tests des gardes ne chargent pas le pilote.
  const { createPool } = await import("../../src/db/pool");
  // createPool : écouteurs d'erreur posés sur le pool et chaque connexion (aucune erreur du pilote non écoutée).
  const killer = createPool(targetUrl, "repro");
  const query = async <Row,>(text: string, values: unknown[]) => {
    try {
      return (await killer.query(text, values)).rows as Row[];
    } catch (error) {
      throw new ReproError(`Requête de coupure en échec (${describe(error)}).`);
    }
  };
  try {
    const start = performance.now();
    const killed = await query<{ ok: boolean }>(
      "select pg_terminate_backend(pid) as ok from unnest($1::int[]) as pid",
      [pids],
    );
    const count = killed.filter((row) => row.ok).length;
    for (;;) {
      const [row] = await query<{ n: number }>(
        "select count(*)::int as n from pg_stat_activity where pid = any($1::int[])",
        [pids],
      );
      if (row?.n === 0) break;
      if (performance.now() - start > LIMIT_MS) {
        throw new ReproError(
          `${row?.n ?? "?"} backend(s) encore présents ${LIMIT_MS} ms après pg_terminate_backend.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return `${count}/${pids.length} backends terminés (pg_terminate_backend), disparus après ${elapsed(start)}`;
  } finally {
    await killer.end().catch(() => undefined);
  }
}

/** Lance l'enfant du test ; `next()` rend son prochain message JSON. */
function startChild(targetUrl: string, trigger: string) {
  const proc = spawn(process.execPath, ["--import", "tsx", CHILD, trigger], {
    cwd: ROOT,
    // Seules variables transmises : de quoi trouver node, et l'URL visée.
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      FROZEN_POOL_URL: targetUrl,
    },
    // stderr ignoré : une erreur non rattrapée du pilote y écrirait son client, mot de passe compris.
    stdio: ["ignore", "pipe", "ignore"],
  });
  const exited = new Promise<string>((resolve) =>
    proc.once("exit", (code, signal) =>
      resolve(`code ${code ?? "aucun"}, signal ${signal ?? "aucun"}`),
    ),
  );
  const lines = createInterface({ input: proc.stdout })[
    Symbol.asyncIterator
  ]();
  return {
    proc,
    async next(): Promise<ChildMessage> {
      const { value, done } = await lines.next();
      if (done) {
        throw new ReproError(
          `L'enfant s'est arrêté sans répondre (${await exited}). Sa sortie d'erreur n'est jamais affichée.`,
        );
      }
      return JSON.parse(value) as ChildMessage;
    },
  };
}

async function main(argv: string[]): Promise<boolean> {
  const { loadEnvFileIfPresent } = await import("../../src/lib/load-env-file");
  loadEnvFileIfPresent(join(ROOT, ".env"));
  let guarded: {
    mode: Mode;
    branch: Branch;
    targetUrl: string;
    suspend?: SuspendConfig;
  };
  try {
    const { mode, branch } = parseArgs(argv);
    const targetUrl = resolveTarget(process.env, branch);
    const suspend =
      mode === "suspend"
        ? resolveSuspendConfig(process.env, targetUrl)
        : undefined;
    guarded = { mode, branch, targetUrl, suspend };
  } catch (error) {
    // Gardes (ici et scripts/neon-host.mjs) : messages faits pour être affichés, noms de variables seulement.
    throw new ReproError(error instanceof Error ? error.message : USAGE);
  }
  const { mode, branch, targetUrl, suspend } = guarded;

  console.log(`BRAIN-50 · coupure : ${mode} · branche Neon : ${branch}`);
  const dir = mkdtempSync(join(tmpdir(), "brain-50-repro-"));
  let child: ChildProcess | undefined;
  try {
    const trigger = join(dir, "reveil");
    const started = startChild(targetUrl, trigger);
    child = started.proc;
    const warmStart = performance.now();
    const ready = await started.next();
    if (ready.type !== "ready") throw new ReproError("Message « ready » attendu.");
    console.log(
      `1. Chauffe : ${new Set(ready.pids).size} connexions distinctes au repos (${elapsed(warmStart)}).`,
    );

    child.kill("SIGSTOP");
    console.log("2. Enfant gelé (SIGSTOP), comme une fonction Vercel en pause.");
    const cut = suspend
      ? await suspendCompute(suspend)
      : await terminateBackends(targetUrl, ready.pids);
    console.log(`3. Coupure : ${cut}.`);

    writeFileSync(trigger, "");
    const wake = performance.now();
    child.kill("SIGCONT");
    const result = await started.next();
    const wakeTime = elapsed(wake);
    if (result.type !== "result") throw new ReproError("Message « result » attendu.");

    const ok = result.outcomes.filter((o) => o.ok).length;
    const failures = result.outcomes.flatMap((o) =>
      o.ok ? [] : [`${o.name}${o.code ? ` (${o.code})` : ""}`],
    );
    const raw = result.rawErrors.map((e) =>
      e.code ?? (e.connectionTerminated ? "Connection terminated" : "autre"),
    );
    const fresh = result.readPids.every((pid) => !ready.pids.includes(pid));
    console.log(
      `4. Réveil (SIGCONT) : ${ok}/${result.outcomes.length} lectures OK en ${wakeTime}.`,
    );
    if (failures.length > 0) console.log(`   Échecs : ${failures.join(", ")}.`);
    console.log(
      `   Nouvelles tentatives : ${result.warnCount} (lignes « Nouvelle tentative sur le pool … »), essais : ${result.attempts}.`,
    );
    console.log(
      `   Erreurs brutes au premier essai : ${raw.length}${raw.length ? ` (${raw.join(", ")})` : ""}.`,
    );
    console.log(
      `   Backends des lectures réussies : ${result.readPids.length === 0 ? "aucun" : fresh ? "tous neufs" : "au moins un backend chauffé (connexion non coupée)"} ; connexions gardées par le pool : ${result.poolTotal}.`,
    );
    const passed = ok === result.outcomes.length;
    console.log(
      passed
        ? "Verdict : OK, les lectures du réveil réussissent."
        : "Verdict : ÉCHEC, au moins une lecture du réveil a échoué (écran d'erreur dans l'app).",
    );
    return passed;
  } finally {
    // SIGKILL agit aussi sur un processus gelé par SIGSTOP.
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  // Filet : rien ne sort d'ici sans être réduit (jamais l'objet d'erreur du pilote ni sa pile).
  process.on("uncaughtException", (error) => {
    console.error(`Erreur : ${describe(error)}`);
    process.exit(2);
  });
  main(process.argv.slice(2)).then(
    (passed) => process.exit(passed ? 0 : 1),
    (error: unknown) => {
      console.error(`Erreur : ${describe(error)}`);
      process.exit(2);
    },
  );
}
