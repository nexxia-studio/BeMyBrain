// Branches Neon de la CI (ADR-010) : crée ou retrouve une branche `ci/…` ou `preview/…`, publie ses deux
// URL (propriétaire et app_backend) dans $GITHUB_ENV après les avoir masquées, ou la supprime.
// Sans dépendance (Node 24 : fetch global). Pourquoi pas neondatabase/create-branch-action : ses sorties
// (URL, hôte) ne sont pas masquées et s'afficheraient dans le bloc `env:` des étapes suivantes.
//
// Usage :
//   node scripts/ci/neon-branch.mjs create <nom> --owner-env <VAR> --app-env <VAR> [--ttl-hours <n>]
//   node scripts/ci/neon-branch.mjs delete <nom>
// Variables : NEON_API_KEY, NEON_PROJECT_ID (secrets) ; APP_BACKEND_PASSWORD (secret, create seulement) ;
// NEON_PARENT_BRANCH (défaut production), NEON_DATABASE (défaut neondb), NEON_OWNER_ROLE (défaut neondb_owner).
// Messages : jamais d'hôte, d'URL ni de corps de réponse de l'API.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const API = "https://console.neon.tech/api/v2";
const APP_ROLE = "app_backend";
const MANAGED_NAME = /^(ci|preview)\/(?!.*\.\.)[A-Za-z0-9._/-]+$/;

/**
 * @typedef {{ apiKey: string, projectId: string, fetch: typeof fetch }} Api
 * @typedef {{ id: string, name: string, default?: boolean, protected?: boolean }} Branch
 */

/** Seules les branches `ci/…` et `preview/…` sont créées ou supprimées par la CI. @param {string} name */
export function assertManagedBranchName(name) {
  if (!MANAGED_NAME.test(name)) {
    throw new Error(
      "Nom de branche refusé : la CI ne gère que les branches ci/ ou preview/ (lettres, chiffres, . _ - /).",
    );
  }
}

/**
 * URL de connexion d'un autre rôle sur la même branche : même hôte, même base, mêmes options.
 * @param {string} ownerUrl @param {string} role @param {string} password
 */
export function withRole(ownerUrl, role, password) {
  const url = new URL(ownerUrl);
  url.username = role;
  url.password = encodeURIComponent(password);
  return url.toString();
}

/** @param {Api} api @param {string} path @param {RequestInit} [init] */
async function call(api, path, init = {}) {
  const response = await api.fetch(`${API}/projects/${api.projectId}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${api.apiKey}`,
    },
  });
  if (!response.ok) {
    // Corps de la réponse jamais affiché : il peut citer un hôte.
    throw new Error(
      `API Neon : HTTP ${response.status} sur ${init.method ?? "GET"} ${path.split("?")[0].replace(/br-[\w-]+/, "<branche>")}.`,
    );
  }
  return response.json();
}

/** @param {Api} api @param {string} name @returns {Promise<Branch | undefined>} */
async function findBranch(api, name) {
  const { branches } = await call(
    api,
    `/branches?search=${encodeURIComponent(name)}`,
  );
  return branches.find((/** @type {Branch} */ b) => b.name === name);
}

/**
 * Crée la branche depuis `parent` (ou retrouve celle du même nom) et renvoie l'URL propriétaire.
 * @param {Api} api
 * @param {{ name: string, parent: string, database: string, ownerRole: string, expiresAt?: string }} options
 */
export async function createBranch(api, options) {
  assertManagedBranchName(options.name);
  let branch = await findBranch(api, options.name);
  const created = !branch;
  if (branch?.default || branch?.protected) {
    throw new Error("Branche existante protégée ou par défaut : refusée.");
  }
  if (!branch) {
    const parent = await findBranch(api, options.parent);
    if (!parent) throw new Error("Branche parente introuvable.");
    ({ branch } = await call(api, "/branches", {
      method: "POST",
      body: JSON.stringify({
        branch: {
          name: options.name,
          parent_id: parent.id,
          ...(options.expiresAt ? { expires_at: options.expiresAt } : {}),
        },
        endpoints: [{ type: "read_write" }],
      }),
    }));
  }
  const query = new URLSearchParams({
    branch_id: /** @type {Branch} */ (branch).id,
    database_name: options.database,
    role_name: options.ownerRole,
  });
  const { uri } = await call(api, `/connection_uri?${query}`);
  return { branchId: /** @type {Branch} */ (branch).id, created, ownerUrl: uri };
}

/** Supprime la branche si elle existe. @param {Api} api @param {string} name */
export async function deleteBranch(api, name) {
  assertManagedBranchName(name);
  const branch = await findBranch(api, name);
  if (!branch) return false;
  if (branch.default || branch.protected) {
    throw new Error("Branche protégée ou par défaut : suppression refusée.");
  }
  await call(api, `/branches/${branch.id}`, { method: "DELETE" });
  return true;
}

/** @param {string[]} args @param {string} flag */
function option(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

/** @param {string} name @param {string | undefined} value */
function required(name, value) {
  if (!value) throw new Error(`${name} manquante.`);
  return value;
}

/** Ligne KEY=valeur pour $GITHUB_ENV / $GITHUB_OUTPUT ; refuse un retour à la ligne (injection). */
function line(/** @type {string} */ key, /** @type {string} */ value) {
  if (/[\r\n]/.test(key + value)) throw new Error(`${key} : valeur multiligne refusée.`);
  return `${key}=${value}\n`;
}

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch: typeof fetch, log: (line: string) => void }} io
 */
export async function run(argv, env, io) {
  const [command, name = "", ...args] = argv;
  assertManagedBranchName(name);
  const api = {
    apiKey: required("NEON_API_KEY", env.NEON_API_KEY),
    projectId: required("NEON_PROJECT_ID", env.NEON_PROJECT_ID),
    fetch: io.fetch,
  };

  if (command === "delete") {
    const deleted = await deleteBranch(api, name);
    io.log(deleted ? `Branche ${name} supprimée.` : `Branche ${name} absente : rien à supprimer.`);
    return;
  }
  if (command !== "create") throw new Error("Commande inconnue : create ou delete.");

  const ownerEnv = required("--owner-env", option(args, "--owner-env"));
  const appEnv = required("--app-env", option(args, "--app-env"));
  const appPassword = required("APP_BACKEND_PASSWORD", env.APP_BACKEND_PASSWORD);
  const ttlHours = Number(option(args, "--ttl-hours") ?? 0);
  const githubEnv = required("GITHUB_ENV", env.GITHUB_ENV);

  const { branchId, created, ownerUrl } = await createBranch(api, {
    name,
    parent: env.NEON_PARENT_BRANCH || "production",
    database: env.NEON_DATABASE || "neondb",
    ownerRole: env.NEON_OWNER_ROLE || "neondb_owner",
    // Filet de sécurité : Neon supprime seule la branche si l'étape de suppression n'a pas tourné.
    expiresAt:
      ttlHours > 0
        ? new Date(Date.now() + ttlHours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z")
        : undefined,
  });
  const appUrl = withRole(ownerUrl, APP_ROLE, appPassword);
  const owner = new URL(ownerUrl);

  // Masques d'abord : aucune valeur ne doit atteindre le journal avant eux.
  const secrets = new Set([
    owner.hostname,
    owner.hostname.replace(/^([^.]+)/, "$1-pooler"),
    decodeURIComponent(owner.password),
    owner.password,
    encodeURIComponent(appPassword),
    ownerUrl,
    appUrl,
  ]);
  for (const value of secrets) if (value) io.log(`::add-mask::${value}`);

  appendFileSync(githubEnv, line(ownerEnv, ownerUrl) + line(appEnv, appUrl));
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, line("branch_id", branchId));
  io.log(`Branche ${name} ${created ? "créée" : "réutilisée"} ; ${ownerEnv} et ${appEnv} posées.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.argv.slice(2), process.env, { fetch, log: (l) => console.log(l) }).catch(
    (/** @type {unknown} */ error) => {
      console.error(error instanceof Error ? error.message : "neon-branch en échec.");
      process.exitCode = 1;
    },
  );
}
