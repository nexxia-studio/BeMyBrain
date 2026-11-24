// Garde des processus enfants lancés par `node --import tsx` (seed-child.mts, frozen-pool-child.mts).
// Hors Vitest, rien n'empêche de les lancer à la main avec une URL de production : ils écrivent ou tuent des
// connexions. Avant toute connexion, chaque enfant exige le marqueur posé par son lanceur (test parent, ou
// scripts/repro/veille-base.mts) et refuse l'hôte ou l'endpoint de NEON_PRODUCTION_HOST.
// Messages : noms de variables seulement, jamais d'hôte ni d'URL.
import {
  hostOfUrl,
  isTrustedPlatform,
  parseHostVariable,
} from "../../scripts/neon-host.mjs";
import { assertNotProductionTarget } from "../../src/db/production-guard";

type Env = Record<string, string | undefined>;

export type ChildGuard = {
  /** Variable à poser à « 1 » par le lanceur (ex. SEED_CHILD). */
  marker: string;
  /** Variable qui porte l'URL visée (ex. DATABASE_URL, FROZEN_POOL_URL). */
  urlVariable: string;
};

/** Id d'endpoint Neon (ep-…) d'un hôte normalisé : son premier segment. */
function endpointOf(host: string): string {
  return host.split(".")[0] ?? host;
}

/** Motif du refus (message sans valeur), ou `undefined` si l'enfant peut se connecter. */
export function childTargetRefusal(
  env: Env,
  { marker, urlVariable }: ChildGuard,
): string | undefined {
  if (env[marker] !== "1") {
    return `${marker}=1 manquant : enfant réservé à son lanceur (test ou script de reproduction).`;
  }
  const url = env[urlVariable];
  if (!url) return `${urlVariable} manquante.`;
  try {
    // Même garde que le seed et drizzle-kit, appliquée à l'URL visée par l'enfant.
    assertNotProductionTarget({ ...env, DATABASE_URL: url });
    if (isTrustedPlatform(env)) return undefined;
    const production = parseHostVariable(
      env.NEON_PRODUCTION_HOST!,
      "NEON_PRODUCTION_HOST",
    );
    // Hôte écrit autrement (segment c-N, région) : même compute si l'id d'endpoint est le même.
    if (endpointOf(hostOfUrl(url, urlVariable)) === endpointOf(production)) {
      return `${urlVariable} vise l'endpoint de NEON_PRODUCTION_HOST : refusé.`;
    }
  } catch (error) {
    // Messages des gardes : noms de variables seulement.
    return error instanceof Error ? error.message : "Cible refusée.";
  }
  return undefined;
}

/** Sortie immédiate, code 2, si la cible est refusée : aucune connexion, aucune valeur affichée. */
export function enforceChildTarget(guard: ChildGuard, env: Env = process.env) {
  const refusal = childTargetRefusal(env, guard);
  if (refusal === undefined) return;
  process.stderr.write(`${refusal}\n`);
  process.exit(2);
}

/** Variables de la garde à transmettre à un enfant : hôte de production (local) ou plateforme de confiance (CI). */
export function childGuardEnv(env: Env = process.env): Record<string, string> {
  return Object.fromEntries(
    ["NEON_PRODUCTION_HOST", "GITHUB_ACTIONS", "VERCEL"].flatMap((name) =>
      env[name] ? [[name, env[name]]] : [],
    ),
  );
}
