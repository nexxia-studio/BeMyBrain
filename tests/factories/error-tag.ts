/**
 * Étiquette sans donnée d'une erreur, pour les assertions des tests base : SQLSTATE ou code s'il y en a un,
 * sinon le nom de la classe. Une erreur brute du pilote peut porter son client (hôte, mot de passe) : passée
 * telle quelle à `expect`, Vitest l'afficherait en entier si l'assertion échouait.
 */
export function errorTag(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string") return code;
  return (
    ((error as { constructor?: { name?: unknown } } | null)?.constructor
      ?.name as string | undefined) ?? typeof error
  );
}
