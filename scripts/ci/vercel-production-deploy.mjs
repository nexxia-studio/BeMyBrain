// Déploiement de production après la migration (BRAIN-37, ADR-010) : la CI crée par l'API Vercel le
// déploiement de production du SHA exact du push, attend qu'il soit prêt (alias posé), échoue sinon.
// vercel.json coupe le déploiement git de main : ce script est le seul déployeur de la production.
// Sans dépendance (Node 24 : fetch global). Doc « Vercel REST API » :
//   GET   /v9/projects/{id}              nom du projet (`name` du déploiement, pas son identifiant)
//   POST  /v13/deployments?forceNew=1    « Create a new deployment » (target production, gitSource github)
//   GET   /v13/deployments/{id}          état
//   PATCH /v12/deployments/{id}/cancel   annulation (délai dépassé, cible inattendue)
// Garde : GitHub `GET /repos/{repo}/git/ref/heads/{branche}` ; un run dépassé par un push plus récent ne déploie pas.
// Variables lues (aucune autre) : VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, SHA, GITHUB_REPOSITORY,
// GITHUB_REPOSITORY_ID, GH_TOKEN, DEFAULT_GIT_BRANCH, GITHUB_STEP_SUMMARY.
// Messages et résumé : jamais de jeton, d'identifiant, d'URL ni de corps de réponse (dépôt public).
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { call, readProjectName } from "./vercel-preview-env.mjs";

const POLL_MS = 10_000;
const POLL_LIMIT = 90; // 15 min.
const FAILED = new Set(["ERROR", "CANCELED"]);
const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 30_000;

/** @param {string} name @param {string | undefined} value */
function required(name, value) {
  if (!value) throw new Error(`${name} manquante.`);
  return value;
}

/**
 * SHA de la tête de la branche par défaut. Le corps de réponse n'est jamais cité.
 * @param {typeof fetch} doFetch @param {string} repository @param {string} branch @param {string} token
 */
async function readBranchHead(doFetch, repository, branch, token) {
  const ref = branch.split("/").map(encodeURIComponent).join("/");
  let response;
  try {
    response = await doFetch(`${GITHUB_API}/repos/${repository}/git/ref/heads/${ref}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    throw new Error("API GitHub : pas de réponse sur la lecture de la branche.");
  }
  if (!response.ok) throw new Error(`API GitHub : HTTP ${response.status} sur la lecture de la branche.`);
  const sha = (await response.json())?.object?.sha;
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("API GitHub : SHA de la branche illisible.");
  }
  return sha;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch: typeof fetch, log: (line: string) => void, sleep?: (ms: number) => Promise<void>, now?: () => number }} io
 */
export async function run(env, io) {
  const sleep = io.sleep ?? ((/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms)));
  const now = io.now ?? Date.now;
  const api = {
    token: required("VERCEL_TOKEN", env.VERCEL_TOKEN),
    projectId: required("VERCEL_PROJECT_ID", env.VERCEL_PROJECT_ID),
    teamId: required("VERCEL_TEAM_ID", env.VERCEL_TEAM_ID),
    fetch: io.fetch,
    sleep,
  };
  const sha = required("SHA", env.SHA);
  const repository = required("GITHUB_REPOSITORY", env.GITHUB_REPOSITORY);
  const repoId = required("GITHUB_REPOSITORY_ID", env.GITHUB_REPOSITORY_ID);
  const ghToken = required("GH_TOKEN", env.GH_TOKEN);
  const branch = required("DEFAULT_GIT_BRANCH", env.DEFAULT_GIT_BRANCH);
  const summaryFile = required("GITHUB_STEP_SUMMARY", env.GITHUB_STEP_SUMMARY);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("SHA refusé : 40 caractères hexadécimaux attendus.");
  /** @param {string} text */
  const summary = (text) => appendFileSync(summaryFile, `${text}\n`);
  const short = sha.slice(0, 7);

  // Dépôt public : identifiants masqués avant tout appel.
  for (const value of new Set([api.projectId, api.teamId])) io.log(`::add-mask::${value}`);

  const head = await readBranchHead(io.fetch, repository, branch, ghToken);
  if (head !== sha) {
    io.log("Déploiement ignoré : la branche a avancé.");
    summary(`Déploiement de production \`${short}\` : remplacé par \`${head.slice(0, 7)}\`.`);
    return;
  }

  const started = now();
  const name = await readProjectName(api);
  const { id, target } = await call(api, "POST deployments", "/v13/deployments", { forceNew: "1" }, {
    method: "POST",
    body: JSON.stringify({
      name,
      project: api.projectId,
      target: "production",
      gitSource: { type: "github", repoId, ref: branch, sha },
    }),
  });
  io.log(`::add-mask::${id}`);

  /** Annule avant l'erreur : un job rouge ne doit pas mettre la production en ligne plus tard. @param {string} message */
  const abort = async (message) => {
    try {
      await call(api, "PATCH cancel", `/v12/deployments/${id}/cancel`, {}, { method: "PATCH" });
    } catch {
      throw new Error(`${message} ; annulation en échec, à annuler à la main.`);
    }
    throw new Error(`${message} ; déploiement annulé.`);
  };
  if (target !== "production") {
    await abort(`Déploiement Vercel de cible ${String(target)} : cible production attendue`);
  }
  io.log("Déploiement de production lancé ; attente de l'état READY.");

  for (let poll = 0; poll < POLL_LIMIT; poll++) {
    const state = await call(api, "GET deployment", `/v13/deployments/${id}`);
    if (state.target != null && state.target !== "production") {
      await abort(`Déploiement Vercel de cible ${String(state.target)} : cible production attendue`);
    }
    // Message de Vercel jamais cité : il peut nommer un alias.
    if (state.aliasError) throw new Error("Déploiement Vercel : erreur d'alias.");
    if (FAILED.has(state.readyState)) {
      throw new Error(`Déploiement Vercel en échec (${state.readyState}).`);
    }
    if (state.readyState === "READY" && state.aliasAssigned) {
      const seconds = Math.round((now() - started) / 1000);
      summary(`Déploiement de production \`${short}\` : READY en ${seconds} s.`);
      io.log(`Production prête (${short}).`);
      return;
    }
    await sleep(POLL_MS);
  }
  await abort("Déploiement Vercel trop long");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.env, { fetch, log: (l) => console.log(l) }).catch((/** @type {unknown} */ error) => {
    console.error(error instanceof Error ? error.message : "vercel-production-deploy en échec.");
    process.exitCode = 1;
  });
}
