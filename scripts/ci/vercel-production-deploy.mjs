// Déploiement de production après la migration (BRAIN-37, ADR-010) : la CI crée par l'API Vercel le
// déploiement de production du SHA exact du push, attend qu'il soit prêt (alias posé), échoue sinon.
// vercel.json coupe le déploiement git de main : ce script est le seul déployeur de la production.
// Sans dépendance (Node 24 : fetch global). Doc « Vercel REST API » :
//   GET   /v9/projects/{id}              nom du projet (`name` du déploiement, pas son identifiant)
//   POST  /v13/deployments?forceNew=1    « Create a new deployment » (target production, gitSource github)
//   GET   /v13/deployments/{id}          état
//   PATCH /v12/deployments/{id}/cancel   annulation (délai dépassé, cible inattendue, toute erreur après création)
// Garde : GitHub `GET /repos/{repo}/git/ref/heads/{branche}` ; un run dépassé par un push plus récent ne déploie pas.
// Variables lues (aucune autre) : VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, SHA, GITHUB_REPOSITORY,
// GITHUB_REPOSITORY_ID, GH_TOKEN, DEFAULT_GIT_BRANCH, GITHUB_STEP_SUMMARY.
// Messages et résumé : jamais de jeton, d'identifiant, d'URL ni de corps de réponse (dépôt public).
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { call, readProjectName } from "./vercel-preview-env.mjs";

const POLL_MS = 10_000;
// Échéance en temps réel, bien sous le timeout-minutes (30) du job : le déploiement est annulé avant.
const DEADLINE_MS = 12 * 60_000;
const POST_RETRIES = 5;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;
const API = "https://api.vercel.com";
const FAILED = new Set(["ERROR", "CANCELED"]);
const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 30_000;

/** Valeur de Vercel citable dans un message : identifiant court, sinon « inconnue ». @param {unknown} value */
function safe(value) {
  return typeof value === "string" && /^[a-z0-9_-]{1,32}$/.test(value)
    ? value
    : "inconnue";
}

/** @param {string} name @param {string | undefined} value */
function required(name, value) {
  if (!value) throw new Error(`${name} manquante.`);
  return value;
}

/** @param {string} name @param {string} value @param {RegExp} pattern */
function matching(name, value, pattern) {
  if (!pattern.test(value))
    throw new Error(`${name} refusée : forme inattendue.`);
  return value;
}

/** Échec définitif, message déjà sûr : ni annulation ni second message. */
class Final extends Error {}

/**
 * SHA de la tête de la branche par défaut. Le corps de réponse n'est jamais cité.
 * @param {typeof fetch} doFetch @param {string} repository @param {string} branch @param {string} token
 */
async function readBranchHead(doFetch, repository, branch, token) {
  const ref = branch.split("/").map(encodeURIComponent).join("/");
  let response;
  try {
    response = await doFetch(
      `${GITHUB_API}/repos/${repository}/git/ref/heads/${ref}`,
      {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  } catch {
    throw new Error(
      "API GitHub : pas de réponse sur la lecture de la branche.",
    );
  }
  if (!response.ok)
    throw new Error(
      `API GitHub : HTTP ${response.status} sur la lecture de la branche.`,
    );
  /** @type {unknown} */
  let sha;
  try {
    sha = (await response.json())?.object?.sha;
  } catch {
    // SyntaxError d'un corps non JSON : jamais citée, elle peut en contenir un extrait.
    throw new Error("API GitHub : SHA de la branche illisible.");
  }
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("API GitHub : SHA de la branche illisible.");
  }
  return sha;
}

/**
 * Une réponse Vercel non JSON lève une SyntaxError qui peut citer un extrait du corps : message générique.
 * @template T @param {Promise<T>} promise @returns {Promise<T>}
 */
async function guarded(promise) {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("API Vercel : réponse illisible.");
    throw error;
  }
}

/**
 * Création du déploiement. Réessai sur 429 et 5xx reçus seulement : après une absence de réponse ou un
 * délai, le déploiement a pu être créé, un second POST (forceNew) en créerait un deuxième en production.
 * @param {{ token: string, projectId: string, teamId: string, fetch: typeof fetch, sleep: (ms: number) => Promise<void> }} api
 * @param {unknown} payload
 */
async function createDeployment(api, payload) {
  const params = new URLSearchParams({ forceNew: "1", teamId: api.teamId });
  for (let attempt = 0; ; attempt++) {
    /** @type {Response} */
    let response;
    try {
      response = await api.fetch(`${API}/v13/deployments?${params}`, {
        method: "POST",
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.token}`,
        },
      });
    } catch {
      throw new Error(
        "API Vercel : pas de réponse à la création ; un déploiement a pu être créé, à vérifier dans Vercel.",
      );
    }
    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < POST_RETRIES
    ) {
      await api.sleep(Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS));
      continue;
    }
    if (!response.ok)
      throw new Error(
        `API Vercel : HTTP ${response.status} sur POST deployments.`,
      );
    return guarded(response.json());
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch: typeof fetch, log: (line: string) => void, sleep?: (ms: number) => Promise<void>, now?: () => number }} io
 */
export async function run(env, io) {
  const sleep =
    io.sleep ??
    ((/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms)));
  const now = io.now ?? Date.now;
  const api = {
    token: required("VERCEL_TOKEN", env.VERCEL_TOKEN),
    projectId: required("VERCEL_PROJECT_ID", env.VERCEL_PROJECT_ID),
    teamId: required("VERCEL_TEAM_ID", env.VERCEL_TEAM_ID),
    fetch: io.fetch,
    sleep,
  };
  const sha = required("SHA", env.SHA);
  const repository = matching(
    "GITHUB_REPOSITORY",
    required("GITHUB_REPOSITORY", env.GITHUB_REPOSITORY),
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
  );
  const repoId = matching(
    "GITHUB_REPOSITORY_ID",
    required("GITHUB_REPOSITORY_ID", env.GITHUB_REPOSITORY_ID),
    /^\d+$/,
  );
  const ghToken = required("GH_TOKEN", env.GH_TOKEN);
  const branch = required("DEFAULT_GIT_BRANCH", env.DEFAULT_GIT_BRANCH);
  // Même contrôle que assertGitBranch (vercel-preview-env.mjs) : longueur Vercel, pas de caractère de contrôle.
  if (branch.length > 250 || /[\u0000-\u001f\u007f]/.test(branch)) {
    throw new Error(
      "DEFAULT_GIT_BRANCH refusée : trop longue ou caractères de contrôle.",
    );
  }
  const summaryFile = required("GITHUB_STEP_SUMMARY", env.GITHUB_STEP_SUMMARY);
  if (!/^[0-9a-f]{40}$/.test(sha))
    throw new Error("SHA refusé : 40 caractères hexadécimaux attendus.");
  /** @param {string} text */
  const summary = (text) => appendFileSync(summaryFile, `${text}\n`);
  const short = sha.slice(0, 7);

  // Dépôt public : identifiants masqués avant tout appel.
  for (const value of new Set([api.projectId, api.teamId]))
    io.log(`::add-mask::${value}`);

  /** @type {string} */
  let head;
  try {
    head = await readBranchHead(io.fetch, repository, branch, ghToken);
  } catch (error) {
    summary(
      `Déploiement de production \`${short}\` : tête de la branche illisible, rien déployé.`,
    );
    throw error;
  }
  if (head !== sha) {
    io.log("Déploiement ignoré : la branche a avancé.");
    summary(
      `Déploiement de production \`${short}\` : remplacé par \`${head.slice(0, 7)}\`.`,
    );
    return;
  }

  const started = now();
  const name = await guarded(readProjectName(api));
  const created = await createDeployment(api, {
    name,
    project: api.projectId,
    target: "production",
    gitSource: { type: "github", repoId, ref: branch, sha },
  });
  const id = created?.id;
  if (typeof id !== "string" || !id)
    throw new Error("API Vercel : déploiement créé sans identifiant.");
  io.log(`::add-mask::${id}`);

  /** Annule avant l'erreur : un job rouge ne doit pas mettre la production en ligne plus tard. @param {string} message */
  const abort = async (message) => {
    try {
      await guarded(
        call(
          api,
          "PATCH cancel",
          `/v12/deployments/${id}/cancel`,
          {},
          { method: "PATCH" },
        ),
      );
    } catch {
      throw new Final(`${message} ; annulation en échec, à annuler à la main.`);
    }
    throw new Final(`${message} ; déploiement annulé.`);
  };
  /** @param {unknown} target */
  const wrongTarget = (target) =>
    abort(
      `Déploiement Vercel de cible ${safe(target)} : cible production attendue`,
    );

  // Toute sortie en erreur après la création passe par abort (annulation puis message sûr).
  try {
    if (created.target !== "production") await wrongTarget(created.target);
    io.log("Déploiement de production lancé ; attente de l'état READY.");

    while (now() - started < DEADLINE_MS) {
      const state = await guarded(
        call(api, "GET deployment", `/v13/deployments/${id}`),
      );
      if (state.target != null && state.target !== "production")
        await wrongTarget(state.target);
      // Messages de Vercel jamais cités : ils peuvent nommer un alias.
      if (state.aliasError)
        throw new Final("Déploiement Vercel : erreur d'alias.");
      if (FAILED.has(state.readyState)) {
        throw new Final(
          `Déploiement Vercel en échec (${state.readyState}).`,
        );
      }
      if (state.readyState === "READY" && state.aliasAssigned) {
        const seconds = Math.round((now() - started) / 1000);
        try {
          summary(
            `Déploiement de production \`${short}\` : READY en ${seconds} s.`,
          );
        } catch {
          // Déjà en ligne : rien à annuler.
          throw new Final(
            "Déploiement de production prêt, mais résumé du job non écrit.",
          );
        }
        io.log(`Production prête (${short}).`);
        return;
      }
      await sleep(POLL_MS);
    }
    await abort("Déploiement Vercel trop long");
  } catch (error) {
    if (error instanceof Final) throw error;
    // Message d'une erreur de `call` sûr par construction (jamais de corps) ; le reste reste générique.
    const known =
      error instanceof Error && error.message.startsWith("API Vercel : ");
    await abort(
      known
        ? error.message.replace(/\.$/, "")
        : "Déploiement Vercel interrompu",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.env, { fetch, log: (l) => console.log(l) }).catch(
    (/** @type {unknown} */ error) => {
      console.error(
        error instanceof Error
          ? error.message
          : "vercel-production-deploy en échec.",
      );
      process.exitCode = 1;
    },
  );
}
