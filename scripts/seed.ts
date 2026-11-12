// Données de départ rejouables (ADR-005) : le workspace d'un propriétaire et ses contextes par défaut.
// Aucune donnée personnelle : le propriétaire vient de SEED_OWNER_USER_ID, le workspace porte un nom générique.
// Usage : `pnpm db:seed` (branche de DATABASE_URL). Production : par la CI uniquement (ADR-010).
import { pathToFileURL } from "node:url";

import { and, asc, eq, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { z } from "zod";

import { contexts, workspaceMembers, workspaces } from "../src/db/schema/core";
import { parseEnv, type EnvSource } from "../src/db/parse-env";
import { assertNotProductionTarget } from "../src/db/production-guard";
import { loadEnvFileIfPresent } from "../src/lib/load-env-file";

export const DEFAULT_WORKSPACE_NAME = "BeMyBrain";

// Noms des entreprises d'Antoine, contenu utilisateur : non traduits.
export const DEFAULT_CONTEXTS = [
  { name: "Privé", kind: "private", position: 0 },
  { name: "Trustup", kind: "pro", position: 1 },
  { name: "Nexxia", kind: "pro", position: 2 },
] as const;

type SeedContext = {
  name: string;
  kind: "private" | "pro";
  position: number;
};

type SeedOptions = {
  ownerUserId: string;
  workspaceName?: string;
  contexts?: readonly SeedContext[];
};

// Tout pilote drizzle Postgres convient (adminDb en CLI, pool de la branche test en test).
type SeedDb = NeonDatabase<Record<string, never>>;

/**
 * Retrouve le workspace dont `ownerUserId` est owner, sinon le crée avec son appartenance owner
 * et les contextes par défaut. Rejouable : un second passage ne crée ni ne modifie rien.
 * Les contextes ne sont posés qu'à la création du workspace : un contexte renommé, réordonné
 * ou supprimé par l'utilisateur n'est jamais recréé ni remis en place.
 */
export async function seedWorkspace(
  db: SeedDb,
  {
    ownerUserId,
    workspaceName = DEFAULT_WORKSPACE_NAME,
    contexts: seedContexts = DEFAULT_CONTEXTS,
  }: SeedOptions,
): Promise<{ workspaceId: string; created: boolean }> {
  return db.transaction(async (tx) => {
    // Deux seeds simultanés pour le même propriétaire : le second attend, puis retrouve le workspace.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${ownerUserId}, 0))`,
    );

    const [existing] = await tx
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, ownerUserId),
          eq(workspaceMembers.role, "owner"),
        ),
      )
      .orderBy(asc(workspaceMembers.createdAt))
      .limit(1);
    if (existing) return { workspaceId: existing.workspaceId, created: false };

    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: workspaceName })
      .returning({ id: workspaces.id });
    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: ownerUserId,
      role: "owner",
      locale: "fr",
    });
    if (seedContexts.length > 0) {
      await tx
        .insert(contexts)
        .values(seedContexts.map((c) => ({ ...c, workspaceId: workspace.id })));
    }
    return { workspaceId: workspace.id, created: true };
  });
}

const seedEnvSchema = z.object({ SEED_OWNER_USER_ID: z.uuid() });

/**
 * Vérifie l'environnement du seed sans rien ouvrir : refuse la production hors plateforme
 * de confiance (même garde-fou que drizzle.config.ts) et exige un SEED_OWNER_USER_ID uuid.
 */
export function parseSeedEnv(source: EnvSource): { ownerUserId: string } {
  // adminDb lit toujours DATABASE_URL : une cible de migration ici ferait croire à un seed de la branche test.
  if (source.MIGRATION_TARGET) {
    throw new Error(
      "MIGRATION_TARGET n'est pas prise en charge par le seed : il vise toujours DATABASE_URL.",
    );
  }
  assertNotProductionTarget(source);
  return { ownerUserId: parseEnv(seedEnvSchema, source).SEED_OWNER_USER_ID };
}

async function main(): Promise<void> {
  loadEnvFileIfPresent();
  // Erreurs des garde-fous : messages maison, sans valeur de variable.
  const { ownerUserId } = parseSeedEnv(process.env);
  // Import après les garde-fous : le pool propriétaire ne s'ouvre qu'une fois la cible validée.
  const { adminDb } = await import("../src/db/admin");
  try {
    const { created } = await seedWorkspace(adminDb, { ownerUserId });
    console.log(
      created
        ? "Seed : workspace et contextes créés."
        : "Seed : workspace déjà présent, rien à faire.",
    );
  } catch {
    // Message générique : une erreur du pilote peut citer l'hôte ou l'utilisateur.
    throw new Error("Seed en échec : erreur de la base, transaction annulée.");
  } finally {
    await adminDb.$client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed en échec.");
    process.exitCode = 1;
  });
}
