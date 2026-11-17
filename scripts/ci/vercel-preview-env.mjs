// Variables de runtime des previews Vercel (ADR-010, option A) : la CI pose sur Vercel, limitées à la
// branche git de la PR, l'URL app_backend et les NEON_AUTH_* de la branche Neon `preview/<branche>`,
// redéploie la branche, puis publie l'origine stable de la preview (alias de branche). À la fermeture
// de la PR, supprime ces variables. Jamais DATABASE_URL (l'app la refuse au runtime Vercel).
// Sans dépendance (Node 24 : fetch global). API REST Vercel, doc « Vercel REST API » :
//   GET    /v10/projects/{id}/env?gitBranch=…   « Retrieve the environment variables of a project »
//   POST   /v10/projects/{id}/env               « Create one or more environment variables »
//   PATCH  /v9/projects/{id}/env/{envId}        « Edit an environment variable »
//   DELETE /v9/projects/{id}/env/{envId}        « Remove an environment variable »
//   POST   /v13/deployments?forceNew=1          « Create a new deployment » (gitSource github, repoId, target)
//   GET    /v13/deployments/{id}                « Get a deployment by ID or URL »
//   PATCH  /v12/deployments/{id}/cancel         « Cancel a deployment » (déploiement de mauvaise cible)
//   GET    /v9/projects/{id}                    « Find a project by id or name » (nom, pour l'alias de branche)
// Seul déployeur des previews : vercel.json coupe les déploiements git hors de main (git.deploymentEnabled).
//
// Usage :
//   node scripts/ci/vercel-preview-env.mjs sync <branche-git>     (valeurs lues dans l'environnement)
//   node scripts/ci/vercel-preview-env.mjs deploy <branche-git> --origin-env <VAR>  (HEAD_SHA, GITHUB_REPOSITORY_ID)
//   node scripts/ci/vercel-preview-env.mjs delete <branche-git>
// Variables : VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID (secrets, posés sur ces seules étapes) ;
// DEFAULT_GIT_BRANCH (branche par défaut du dépôt, toujours refusée : c'est la production).
// Messages : jamais de valeur, d'hôte, d'URL, d'identifiant de projet ou d'équipe, ni de corps de réponse.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const API = "https://api.vercel.com";
/** Variables posées sur chaque preview. DATABASE_URL n'y figure jamais (ADR-010). */
export const PREVIEW_KEYS = Object.freeze([
  "DATABASE_AUTHENTICATED_URL",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_JWKS_URL",
  "NEON_AUTH_ISSUER",
  "NEON_AUTH_AUDIENCE",
]);
const POLL_MS = 10_000;
const POLL_LIMIT = 72; // 12 min : build Next complet.
const FAILED = new Set(["ERROR", "CANCELED"]);
const REQUEST_TIMEOUT_MS = 30_000;
const RETRIES = 5;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;

/**
 * @typedef {{ token: string, projectId: string, teamId: string, fetch: typeof fetch, sleep?: (ms: number) => Promise<void> }} Api
 * @typedef {{ id: string, key: string, target?: string[] | string, gitBranch?: string }} EnvVar
 * @typedef {{ id: string }} Deployment
 */

const defaultSleep = (/** @type {number} */ ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Appel REST borné dans le temps ; réessaie 429, 5xx et absence de réponse (attente exponentielle bornée).
 * Un POST réessayé peut avoir abouti côté Vercel : le réessai échoue alors en 4xx, explicite, et un nouveau
 * passage de la CI repart de l'état réel (sync lit l'existant, deploy force un nouveau build).
 * @param {Api} api @param {string} label description sans identifiant, pour les messages d'erreur
 * @param {string} path @param {Record<string, string>} [query] @param {RequestInit} [init]
 */
async function call(api, label, path, query = {}, init = {}) {
  const sleep = api.sleep ?? defaultSleep;
  const params = new URLSearchParams({ ...query, teamId: api.teamId });
  for (let attempt = 0; ; attempt++) {
    const retry = attempt < RETRIES;
    /** @type {Response} */
    let response;
    try {
      response = await api.fetch(`${API}${path}?${params}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.token}`,
        },
      });
    } catch {
      // Erreur d'origine jamais citée (cause réseau, hôte).
      if (!retry) throw new Error(`API Vercel : pas de réponse sur ${label}.`);
      await sleep(Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS));
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && retry) {
      await sleep(Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS));
      continue;
    }
    // Corps jamais affiché : il peut citer une valeur, un projet ou une équipe.
    if (!response.ok) throw new Error(`API Vercel : HTTP ${response.status} sur ${label}.`);
    return response.json();
  }
}

/** Nom de branche git accepté par Vercel (gitBranch ≤ 250) et sûr pour une ligne de journal. @param {string} gitBranch */
function assertGitBranch(gitBranch) {
  if (!gitBranch || gitBranch.length > 250 || /[\u0000-\u001f\u007f]/.test(gitBranch)) {
    throw new Error("Branche git refusée : vide, trop longue ou caractères de contrôle.");
  }
}

/** Variables de la preview posées sur cette branche exactement (ni « toutes les previews », ni une autre). */
async function branchVars(/** @type {Api} */ api, /** @type {string} */ gitBranch) {
  const { envs = [] } = await call(api, "GET env", `/v10/projects/${api.projectId}/env`, {
    gitBranch,
  });
  return /** @type {EnvVar[]} */ (envs).filter(
    (e) => e.gitBranch === gitBranch && PREVIEW_KEYS.includes(e.key),
  );
}

/**
 * Pose (crée ou met à jour) les variables de la preview, chiffrées, target preview, limitées à la branche git.
 * @param {Api} api @param {string} gitBranch @param {Record<string, string | undefined>} values
 */
export async function syncPreviewEnv(api, gitBranch, values) {
  assertGitBranch(gitBranch);
  for (const key of PREVIEW_KEYS) if (!values[key]) throw new Error(`${key} manquante.`);
  /** @param {string} key */
  const desired = (key) => ({
    value: /** @type {string} */ (values[key]),
    type: "encrypted",
    target: ["preview"],
    gitBranch,
  });

  const existing = await branchVars(api, gitBranch);
  let updated = 0;
  for (const variable of existing) {
    await call(api, "PATCH env", `/v9/projects/${api.projectId}/env/${variable.id}`, {}, {
      method: "PATCH",
      body: JSON.stringify(desired(variable.key)),
    });
    updated++;
  }
  const missing = PREVIEW_KEYS.filter((key) => !existing.some((e) => e.key === key));
  if (missing.length > 0) {
    await call(api, "POST env", `/v10/projects/${api.projectId}/env`, {}, {
      method: "POST",
      body: JSON.stringify(missing.map((key) => ({ key, ...desired(key) }))),
    });
  }
  return { created: missing.length, updated };
}

/** Supprime les variables de la preview posées sur la branche git. @param {Api} api @param {string} gitBranch */
export async function deletePreviewEnv(api, gitBranch) {
  assertGitBranch(gitBranch);
  const existing = await branchVars(api, gitBranch);
  for (const variable of existing) {
    await call(api, "DELETE env", `/v9/projects/${api.projectId}/env/${variable.id}`, {}, {
      method: "DELETE",
    });
  }
  return existing.length;
}

/**
 * Nouveau déploiement preview du commit de la PR : il lit les variables posées juste avant.
 * forceNew=1 : sinon Vercel peut réutiliser un build du même commit, sans ces variables.
 * target "preview" demandé, et vérifié dans la réponse (null = preview, doc « Create a new deployment »).
 * @param {Api} api @param {{ gitBranch: string, sha: string, repoId: string }} source
 * @returns {Promise<Deployment>}
 */
export async function deployBranch(api, { gitBranch, sha, repoId }) {
  assertGitBranch(gitBranch);
  const { id, target } = await call(api, "POST deployments", "/v13/deployments", { forceNew: "1" }, {
    method: "POST",
    body: JSON.stringify({
      // `project` l'emporte sur `name` (doc) ; `name` reste requis par le schéma.
      name: api.projectId,
      project: api.projectId,
      target: "preview",
      gitSource: { type: "github", repoId, ref: gitBranch, sha },
    }),
  });
  if (target != null && target !== "preview") {
    const message = `Déploiement Vercel de cible ${String(target)} : cible preview attendue`;
    // Annulé avant l'erreur, pour qu'il ne serve jamais ; un échec d'annulation ne masque pas l'erreur.
    try {
      await call(api, "PATCH cancel", `/v12/deployments/${id}/cancel`, {}, { method: "PATCH" });
    } catch {
      throw new Error(`${message} ; annulation en échec, à annuler à la main.`);
    }
    throw new Error(`${message} ; déploiement annulé.`);
  }
  return { id };
}

/**
 * Attend que le déploiement soit prêt et ses alias posés, puis renvoie l'origine de l'alias de branche
 * (`<projet>-git-<branche>-<équipe>.vercel.app`, éventuellement tronqué : lu, jamais calculé). Le nom
 * du projet est lu chez Vercel : le `name` du déploiement est l'identifiant envoyé, pas ce nom.
 * @param {Api} api @param {string} deploymentId
 */
export async function waitForBranchOrigin(api, deploymentId) {
  const sleep = api.sleep ?? defaultSleep;
  const { name: projectName } = await call(api, "GET project", `/v9/projects/${api.projectId}`);
  if (!projectName) throw new Error("Projet Vercel sans nom : alias de branche introuvable.");
  for (let poll = 0; poll < POLL_LIMIT; poll++) {
    const state = await call(api, "GET deployment", `/v13/deployments/${deploymentId}`);
    // Message de Vercel jamais cité : il peut nommer un alias.
    if (state.aliasError) throw new Error("Déploiement Vercel : erreur d'alias.");
    if (FAILED.has(state.readyState)) {
      throw new Error(`Déploiement Vercel en échec (${state.readyState}).`);
    }
    if (state.readyState === "READY" && state.aliasAssigned) {
      const alias = /** @type {string[]} */ (state.alias ?? []).find((a) =>
        a.startsWith(`${projectName}-git-`),
      );
      if (!alias) throw new Error("Déploiement Vercel prêt, mais alias de branche introuvable.");
      return `https://${alias}`;
    }
    await sleep(POLL_MS);
  }
  throw new Error("Déploiement Vercel trop long : abandon.");
}

/** @param {string} name @param {string | undefined} value */
function required(name, value) {
  if (!value) throw new Error(`${name} manquante.`);
  return value;
}

/** @param {string[]} args @param {string} flag */
function option(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

/** Ligne KEY=valeur pour $GITHUB_ENV ; refuse un retour à la ligne (injection). */
function line(/** @type {string} */ key, /** @type {string} */ value) {
  if (/[\r\n]/.test(key + value)) throw new Error(`${key} : valeur multiligne refusée.`);
  return `${key}=${value}\n`;
}

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch: typeof fetch, log: (line: string) => void, sleep?: (ms: number) => Promise<void> }} io
 */
export async function run(argv, env, io) {
  const [command, gitBranch = "", ...args] = argv;
  if (!["sync", "deploy", "delete"].includes(command)) {
    throw new Error("Commande inconnue : sync, deploy ou delete.");
  }
  /** @type {Api} */
  const api = {
    token: required("VERCEL_TOKEN", env.VERCEL_TOKEN),
    projectId: required("VERCEL_PROJECT_ID", env.VERCEL_PROJECT_ID),
    teamId: required("VERCEL_TEAM_ID", env.VERCEL_TEAM_ID),
    fetch: io.fetch,
    sleep: io.sleep,
  };
  // Branche par défaut = production : jamais de variables ni de déploiement « preview » dessus.
  if (gitBranch === required("DEFAULT_GIT_BRANCH", env.DEFAULT_GIT_BRANCH)) {
    throw new Error("Branche git refusée : branche par défaut du dépôt (production).");
  }
  /** @param {(string | undefined)[]} values */
  const mask = (values) => {
    for (const value of new Set(values)) if (value) io.log(`::add-mask::${value}`);
  };
  // Dépôt public : identifiants de projet et d'équipe masqués avant tout appel.
  mask([api.projectId, api.teamId]);

  if (command === "sync") {
    mask(PREVIEW_KEYS.map((key) => env[key]));
    const { created, updated } = await syncPreviewEnv(api, gitBranch, env);
    io.log(`Variables de la preview : ${created} créées, ${updated} mises à jour (branche ${gitBranch}).`);
    return;
  }
  if (command === "delete") {
    const removed = await deletePreviewEnv(api, gitBranch);
    io.log(`Variables de la preview supprimées : ${removed} (branche ${gitBranch}).`);
    return;
  }

  const originEnv = required("--origin-env", option(args, "--origin-env"));
  const sha = required("HEAD_SHA", env.HEAD_SHA);
  const repoId = required("GITHUB_REPOSITORY_ID", env.GITHUB_REPOSITORY_ID);
  const githubEnv = required("GITHUB_ENV", env.GITHUB_ENV);
  const deployment = await deployBranch(api, { gitBranch, sha, repoId });
  mask([deployment.id]);
  io.log(`Redéploiement de la branche ${gitBranch} lancé ; attente de l'alias de branche.`);
  const origin = await waitForBranchOrigin(api, deployment.id);
  mask([new URL(origin).hostname, origin]);
  appendFileSync(githubEnv, line(originEnv, origin));
  io.log(`Preview prête ; ${originEnv} posée.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.argv.slice(2), process.env, { fetch, log: (l) => console.log(l) }).catch(
    (/** @type {unknown} */ error) => {
      console.error(error instanceof Error ? error.message : "vercel-preview-env en échec.");
      process.exitCode = 1;
    },
  );
}
