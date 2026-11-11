import { defineConfig } from "vitest/config";

// Variables des tests d'intégration (DATABASE_TEST_*) ; .env absent en CI, où elles viennent de l'environnement.
// Même logique que src/lib/load-env-file.ts, recopiée ici : le chargeur natif de Vite refuse l'import d'un .ts CommonJS.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// Garde-fou : la branche test est distincte de la branche locale et de la production.
// Recopie de normalizeNeonHost (src/db/production-guard.ts), même raison que ci-dessus.
// Messages : noms de variables seulement.
function host(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  let hostname: string;
  try {
    hostname =
      name === "NEON_PRODUCTION_HOST" ? value : new URL(value).hostname;
  } catch {
    throw new Error(`${name} n'est pas une URL de connexion lisible.`);
  }
  const [first, ...rest] = hostname.trim().toLowerCase().split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

const testHost = host("DATABASE_TEST_URL");
const testAuthenticatedHost = host("DATABASE_TEST_AUTHENTICATED_URL");
if (testHost || testAuthenticatedHost) {
  if (testHost !== testAuthenticatedHost) {
    throw new Error(
      "DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL doivent viser la même branche Neon (test).",
    );
  }
  if (testHost === host("DATABASE_URL")) {
    throw new Error(
      "DATABASE_TEST_URL vise la même branche que DATABASE_URL : tests arrêtés.",
    );
  }
  const productionHost = host("NEON_PRODUCTION_HOST");
  if (!productionHost && !process.env.CI && process.env.VERCEL !== "1") {
    throw new Error(
      "NEON_PRODUCTION_HOST manquante : obligatoire en local pour vérifier que DATABASE_TEST_URL ne vise pas la production.",
    );
  }
  if (testHost === productionHost) {
    throw new Error(
      "DATABASE_TEST_URL vise NEON_PRODUCTION_HOST : tests arrêtés.",
    );
  }
}

// Aucun test ne touche la branche de l'environnement local : les connexions de l'app
// pointent sur la branche test, ou n'existent pas.
for (const [name, testName] of [
  ["DATABASE_URL", "DATABASE_TEST_URL"],
  ["DATABASE_AUTHENTICATED_URL", "DATABASE_TEST_AUTHENTICATED_URL"],
] as const) {
  const testUrl = process.env[testName];
  if (testUrl) process.env[name] = testUrl;
  else delete process.env[name];
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
});
