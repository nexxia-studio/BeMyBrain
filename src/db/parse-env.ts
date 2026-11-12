import type { z } from "zod";

export type EnvSource = Record<string, string | undefined>;

/** Valide `source` ; l'erreur nomme les variables fautives, jamais leur valeur. */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: EnvSource,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join(".");
    const reason =
      issue.code === "invalid_type" ? "manquante" : "format invalide";
    return `${name} (${reason})`;
  });
  throw new Error(
    `Variables d'environnement invalides : ${problems.join(", ")}. Voir .env.example.`,
  );
}
