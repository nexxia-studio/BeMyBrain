// Branches Neon de la CI (ADR-010) : crée ou retrouve une branche `ci/…` ou `preview/…`, réinitialise sur
// CETTE branche les mots de passe du rôle propriétaire et d'app_backend (jamais ceux hérités du parent),
// publie les deux URL dans $GITHUB_ENV après les avoir masquées, ou supprime la branche.
// Avec --auth-env, publie aussi les NEON_AUTH_* de l'instance Neon Auth propre à la branche
// (GET …/branches/{id}/auth, doc Neon « Manage Managed Better Auth via the API »). La commande trust
// ajoute une origine aux domaines de confiance Neon Auth de la branche (doc Neon « Configure trusted domains »).
// Sans dépendance (Node 24 : fetch global). Pourquoi pas neondatabase/create-branch-action : ses sorties
// (URL, hôte) ne sont pas masquées et s'afficheraient dans le bloc `env:` des étapes suivantes.
//
// Usage :
//   node scripts/ci/neon-branch.mjs create <nom> [--owner-env <VAR>] [--app-env <VAR>] [--ttl-hours <n>] [--auth-env]
//   (au moins une des trois sorties ; les deux mots de passe sont toujours réinitialisés, seule l'URL
//   demandée est écrite. Branche du même nom retrouvée : réutilisée, mots de passe réinitialisés.)
//   node scripts/ci/neon-branch.mjs trust <nom>      (origine lue dans TRUSTED_ORIGIN)
//   node scripts/ci/neon-branch.mjs delete <nom>
// Variables : NEON_API_KEY, NEON_PROJECT_ID (secrets, posés sur cette seule étape) ;
// NEON_PARENT_BRANCH (défaut test), NEON_DATABASE (défaut neondb), NEON_OWNER_ROLE (défaut neondb_owner) ;
// DEFAULT_GIT_BRANCH (branche par défaut du dépôt), exigée pour une branche preview/ : sa preview est refusée.
// Messages : jamais d'hôte, d'URL, de mot de passe ni de corps de réponse de l'API.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const API = "https://console.neon.tech/api/v2";
const APP_ROLE = "app_backend";
const MANAGED_NAME = /^(ci|preview)\/(?!.*\.\.)[A-Za-z0-9._/-]+$/;
// Doc Neon « Operations » : succès = finished ou skipped ; échec = failed, error, cancelled.
const DONE = new Set(["finished", "skipped"]);
const FAILED = new Set(["failed", "error", "cancelled"]);
const POLL_MS = 2_000;
const POLL_LIMIT = 90; // 3 min
const LOCKED_RETRIES = 5;

/**
 * @typedef {{ apiKey: string, projectId: string, fetch: typeof fetch, sleep?: (ms: number) => Promise<void> }} Api
 * @typedef {{ id: string, name: string, default?: boolean, protected?: boolean }} Branch
 * @typedef {{ id: string, status: string }} Operation
 */

const defaultSleep = (/** @type {number} */ ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Seules les branches `ci/…` et `preview/…` sont créées, modifiées ou supprimées par la CI. @param {string} name */
export function assertManagedBranchName(name) {
  if (!MANAGED_NAME.test(name)) {
    throw new Error(
      "Nom de branche refusé : la CI ne gère que les branches ci/ ou preview/ (lettres, chiffres, . _ - /).",
    );
  }
}

/**
 * URL de connexion d'un rôle sur la branche du gabarit : même hôte, même base, mêmes options.
 * @param {string} templateUrl @param {string} role @param {string} password
 */
export function withRole(templateUrl, role, password) {
  const url = new URL(templateUrl);
  url.username = role;
  url.password = encodeURIComponent(password);
  return url.toString();
}

/**
 * Chemin d'API citable dans un message : sans requête, chaque identifiant de branche et chaque rôle masqués.
 * @param {string} path
 */
export function redactPath(path) {
  return path
    .split("?")[0]
    .replace(/br-[\w-]+/g, "<branche>")
    .replace(/roles\/[^/]+/g, "roles/<rôle>");
}

/**
 * @param {Api} api @param {string} path @param {RequestInit} [init]
 * @param {{ allowNotFound?: boolean }} [options] 404 → null au lieu d'une erreur.
 */
async function call(api, path, init = {}, options = {}) {
  const sleep = api.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    const response = await api.fetch(`${API}/projects/${api.projectId}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${api.apiKey}`,
      },
    });
    // 423 : projet verrouillé par une opération en cours (doc Neon « Operations ») → réessai.
    if (response.status === 423 && attempt < LOCKED_RETRIES) {
      await sleep(POLL_MS * 2 ** attempt);
      continue;
    }
    if (response.status === 404 && options.allowNotFound) return null;
    if (!response.ok) {
      // Corps de la réponse jamais affiché : il peut citer un hôte.
      throw new Error(`API Neon : HTTP ${response.status} sur ${init.method ?? "GET"} ${redactPath(path)}.`);
    }
    return response.json();
  }
}

/** Attend la fin des opérations lancées par un appel. @param {Api} api @param {Operation[] | undefined} operations */
async function waitForOperations(api, operations = []) {
  const sleep = api.sleep ?? defaultSleep;
  for (const { id, status: initial } of operations) {
    let status = initial;
    for (let poll = 0; !DONE.has(status); poll++) {
      if (FAILED.has(status)) throw new Error(`Une opération Neon en échec (${status}).`);
      if (poll >= POLL_LIMIT) throw new Error("Opération Neon trop longue : abandon.");
      await sleep(POLL_MS);
      ({
        operation: { status },
      } = await call(api, `/operations/${id}`));
    }
  }
}

/** @param {Api} api @param {string} name @returns {Promise<Branch | undefined>} */
async function findBranch(api, name) {
  const { branches } = await call(api, `/branches?search=${encodeURIComponent(name)}`);
  return branches.find((/** @type {Branch} */ b) => b.name === name);
}

/**
 * Nouveau mot de passe généré par Neon pour `role` sur la branche gérée `branchId`.
 * @param {Api} api @param {string} branchId @param {string} role
 */
async function resetPassword(api, branchId, role) {
  const { role: updated, operations } = await call(
    api,
    `/branches/${branchId}/roles/${encodeURIComponent(role)}/reset_password`,
    { method: "POST" },
  );
  await waitForOperations(api, operations);
  return /** @type {string} */ (updated.password);
}

/**
 * Crée la branche depuis `parent` (ou retrouve celle du même nom et repousse son expiration),
 * réinitialise les mots de passe du propriétaire et d'app_backend sur cette branche, renvoie les URL.
 * @param {Api} api
 * @param {{ name: string, parent: string, database: string, ownerRole: string, appRole?: string, expiresAt?: string }} options
 */
export async function createBranch(api, options) {
  assertManagedBranchName(options.name);
  const appRole = options.appRole ?? APP_ROLE;
  const existing = await findBranch(api, options.name);
  if (existing?.default || existing?.protected) {
    throw new Error("Branche existante protégée ou par défaut : refusée.");
  }
  /** @type {string} */
  let branchId;
  if (existing) {
    branchId = existing.id;
    if (options.expiresAt) {
      const { operations } = await call(api, `/branches/${branchId}`, {
        method: "PATCH",
        body: JSON.stringify({ branch: { expires_at: options.expiresAt } }),
      });
      await waitForOperations(api, operations);
    }
  } else {
    const parent = await findBranch(api, options.parent);
    if (!parent) throw new Error("Branche parente introuvable.");
    const { branch, operations } = await call(api, "/branches", {
      method: "POST",
      body: JSON.stringify({
        branch: {
          name: options.name,
          parent_id: parent.id,
          ...(options.expiresAt ? { expires_at: options.expiresAt } : {}),
        },
        endpoints: [{ type: "read_write" }],
      }),
    });
    branchId = branch.id;
    await waitForOperations(api, operations);
  }

  // Une branche fille hérite des mots de passe de son parent : on les remplace avant tout usage.
  const ownerPassword = await resetPassword(api, branchId, options.ownerRole);
  const appPassword = await resetPassword(api, branchId, appRole);

  // Gabarit (hôte, base, options) seulement : son mot de passe n'est jamais réutilisé.
  const query = new URLSearchParams({
    branch_id: branchId,
    database_name: options.database,
    role_name: options.ownerRole,
  });
  const { uri: templateUrl } = await call(api, `/connection_uri?${query}`);
  return {
    branchId,
    created: !existing,
    templateUrl,
    ownerPassword,
    appPassword,
    ownerUrl: withRole(templateUrl, options.ownerRole, ownerPassword),
    appUrl: withRole(templateUrl, appRole, appPassword),
  };
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

/**
 * Configuration Neon Auth de la branche (une instance par branche, doc Neon « Branching authentication ») :
 * iss et aud des jetons = origine de base_url (src/env.ts).
 * @param {Api} api @param {string} branchId
 */
export async function getAuthConfig(api, branchId) {
  const auth = await call(api, `/branches/${branchId}/auth`, {}, { allowNotFound: true });
  if (!auth) {
    throw new Error(
      "Neon Auth absent de la branche : l'activer sur la branche parente, puis recréer la branche de preview.",
    );
  }
  /** @param {unknown} value */
  const https = (value) => {
    try {
      const url = new URL(String(value));
      return url.protocol === "https:" ? url : undefined;
    } catch {
      return undefined;
    }
  };
  const base = https(auth.base_url);
  const jwks = https(auth.jwks_url);
  if (!base || !jwks || jwks.origin !== base.origin) {
    // Valeurs jamais citées : elles portent l'hôte de la branche.
    throw new Error("Neon Auth : configuration Neon Auth inattendue (base_url ou jwks_url).");
  }
  return {
    baseUrl: /** @type {string} */ (auth.base_url),
    jwksUrl: /** @type {string} */ (auth.jwks_url),
    issuer: base.origin,
    audience: base.origin,
  };
}

/** Origine https exacte (schéma + hôte, sans chemin, barre finale ni joker). @param {string} origin */
function assertOrigin(origin) {
  let ok = false;
  try {
    const url = new URL(origin);
    ok = url.protocol === "https:" && url.origin === origin && !origin.includes("*");
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("Domaine de confiance refusé : origine https exacte attendue.");
}

/**
 * Ajoute `origin` aux domaines de confiance Neon Auth de la branche gérée `name`, s'il n'y est pas.
 * @param {Api} api @param {string} name @param {string} origin @returns {Promise<boolean>} ajouté ?
 */
export async function trustOrigin(api, name, origin) {
  assertManagedBranchName(name);
  assertOrigin(origin);
  const branch = await findBranch(api, name);
  if (!branch) throw new Error("Branche introuvable.");
  if (branch.default || branch.protected) {
    throw new Error("Branche protégée ou par défaut : domaine de confiance refusé.");
  }
  const path = `/branches/${branch.id}/auth/domains`;
  const { domains = [] } = await call(api, path);
  if (domains.some((/** @type {{ domain: string }} */ d) => d.domain === origin)) return false;
  await call(api, path, {
    method: "POST",
    body: JSON.stringify({ domain: origin, auth_provider: "better_auth" }),
  });
  return true;
}

/** Valeurs à masquer d'une configuration Neon Auth : hôte, son premier segment, origine, URL. */
function authSecretsOf(/** @type {Awaited<ReturnType<typeof getAuthConfig>>} */ auth) {
  const host = new URL(auth.baseUrl).hostname;
  return [host.split(".")[0], host, auth.issuer, auth.baseUrl, auth.jwksUrl];
}

/** Valeurs à masquer : hôte direct et pooler, leur premier segment (endpoint), mots de passe, URL. */
function secretsOf(/** @type {Awaited<ReturnType<typeof createBranch>>} */ result) {
  const template = new URL(result.templateUrl);
  const host = template.hostname;
  const endpoint = host.split(".")[0].replace(/-pooler$/, "");
  const pooledHost = host.replace(/^[^.]+/, `${endpoint}-pooler`);
  return [
    endpoint,
    `${endpoint}-pooler`,
    host,
    pooledHost,
    template.password,
    decodeURIComponent(template.password),
    result.ownerPassword,
    encodeURIComponent(result.ownerPassword),
    result.appPassword,
    encodeURIComponent(result.appPassword),
    result.templateUrl,
    result.ownerUrl,
    result.appUrl,
  ];
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
 * @param {{ fetch: typeof fetch, log: (line: string) => void, sleep?: (ms: number) => Promise<void> }} io
 */
export async function run(argv, env, io) {
  const [command, name = "", ...args] = argv;
  assertManagedBranchName(name);
  // La preview de la branche par défaut (production) n'existe jamais : ni création, ni domaine, ni suppression.
  if (
    name.startsWith("preview/") &&
    name === `preview/${required("DEFAULT_GIT_BRANCH", env.DEFAULT_GIT_BRANCH)}`
  ) {
    throw new Error("Nom de branche refusé : preview de la branche par défaut du dépôt.");
  }
  /** @type {Api} */
  const api = {
    apiKey: required("NEON_API_KEY", env.NEON_API_KEY),
    projectId: required("NEON_PROJECT_ID", env.NEON_PROJECT_ID),
    fetch: io.fetch,
    sleep: io.sleep,
  };

  if (command === "trust") {
    const added = await trustOrigin(api, name, required("TRUSTED_ORIGIN", env.TRUSTED_ORIGIN));
    io.log(
      added
        ? `Domaine de confiance ajouté à Neon Auth de ${name}.`
        : `Domaine de confiance déjà présent sur ${name}.`,
    );
    return;
  }
  if (command === "delete") {
    const deleted = await deleteBranch(api, name);
    io.log(deleted ? `Branche ${name} supprimée.` : `Branche ${name} absente : rien à supprimer.`);
    return;
  }
  if (command !== "create") throw new Error("Commande inconnue : create, trust ou delete.");

  const ownerEnv = option(args, "--owner-env");
  const appEnv = option(args, "--app-env");
  const withAuth = args.includes("--auth-env");
  if (!ownerEnv && !appEnv && !withAuth) {
    throw new Error("create : --owner-env, --app-env ou --auth-env attendu (sinon rien n'est publié).");
  }
  const ttlHours = Number(option(args, "--ttl-hours") ?? 0);
  const githubEnv = required("GITHUB_ENV", env.GITHUB_ENV);

  const result = await createBranch(api, {
    name,
    parent: env.NEON_PARENT_BRANCH || "test",
    database: env.NEON_DATABASE || "neondb",
    ownerRole: env.NEON_OWNER_ROLE || "neondb_owner",
    // Filet de sécurité : Neon supprime seule la branche si personne ne l'a fait avant.
    expiresAt:
      ttlHours > 0
        ? new Date(Date.now() + ttlHours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z")
        : undefined,
  });

  // Lue avant toute écriture : sans Neon Auth sur la branche, rien n'est publié.
  const auth = withAuth ? await getAuthConfig(api, result.branchId) : undefined;

  // Masques d'abord : aucune valeur ne doit atteindre le journal avant eux.
  const secrets = [...secretsOf(result), ...(auth ? authSecretsOf(auth) : [])];
  for (const value of new Set(secrets)) if (value) io.log(`::add-mask::${value}`);

  appendFileSync(
    githubEnv,
    (ownerEnv ? line(ownerEnv, result.ownerUrl) : "") +
      (appEnv ? line(appEnv, result.appUrl) : "") +
      (auth
        ? line("NEON_AUTH_BASE_URL", auth.baseUrl) +
          line("NEON_AUTH_JWKS_URL", auth.jwksUrl) +
          line("NEON_AUTH_ISSUER", auth.issuer) +
          line("NEON_AUTH_AUDIENCE", auth.audience)
        : ""),
  );
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, line("branch_id", result.branchId));
  io.log(
    `Branche ${name} ${result.created ? "créée" : "réutilisée"} ; mots de passe réinitialisés ; ${[ownerEnv, appEnv, auth && "NEON_AUTH_*"].filter(Boolean).join(" et ")} posées.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.argv.slice(2), process.env, { fetch, log: (l) => console.log(l) }).catch(
    (/** @type {unknown} */ error) => {
      console.error(error instanceof Error ? error.message : "neon-branch en échec.");
      process.exitCode = 1;
    },
  );
}
