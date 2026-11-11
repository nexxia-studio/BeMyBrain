/**
 * Charge `.env` hors de Next (drizzle-kit, scripts, Vitest) avec l'API native de Node.
 * Absent en CI ou sur Vercel : les variables viennent alors de l'environnement.
 * Ne remplace jamais une variable déjà définie.
 */
export function loadEnvFileIfPresent(path = ".env"): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
