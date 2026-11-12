import { defineConfig } from "vitest/config";

import {
  hostOfUrl,
  isTrustedPlatform,
  parseHostVariable,
} from "./scripts/neon-host.mjs";

// Variables des tests d'intégration (DATABASE_TEST_*) ; .env absent en CI, où elles viennent de l'environnement.
// Même logique que src/lib/load-env-file.ts, recopiée ici : le chargeur natif de Vite refuse l'import d'un .ts CommonJS.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// Garde-fou : la branche test est distincte de la branche locale et de la production.
// Logique d'hôte partagée avec src/db/production-guard.ts (scripts/neon-host.mjs, sans .ts).
// Messages : noms de variables seulement.
function urlHost(name: string): string | undefined {
  const value = process.env[name];
  return value ? hostOfUrl(value, name) : undefined;
}

const testHost = urlHost("DATABASE_TEST_URL");
const testAuthenticatedHost = urlHost("DATABASE_TEST_AUTHENTICATED_URL");
if (testHost || testAuthenticatedHost) {
  if (testHost !== testAuthenticatedHost) {
    throw new Error(
      "DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL doivent viser la même branche Neon (test).",
    );
  }
  for (const name of ["DATABASE_URL", "DATABASE_AUTHENTICATED_URL"]) {
    if (testHost === urlHost(name)) {
      throw new Error(
        `DATABASE_TEST_URL vise la même branche que ${name} : tests arrêtés.`,
      );
    }
  }
  const productionHostValue = process.env.NEON_PRODUCTION_HOST;
  if (!productionHostValue && !isTrustedPlatform(process.env)) {
    throw new Error(
      "NEON_PRODUCTION_HOST manquante : obligatoire en local pour vérifier que DATABASE_TEST_URL ne vise pas la production.",
    );
  }
  if (
    productionHostValue &&
    testHost === parseHostVariable(productionHostValue, "NEON_PRODUCTION_HOST")
  ) {
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
  resolve: {
    tsconfigPaths: true,
    // `server-only` n'est pas une dépendance : Next l'aliase vers son exemplaire compilé. Sous Vitest
    // (tests serveur), même alias vers la variante vide.
    alias: {
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // @neon/auth importe « next/headers » sans extension : Node ESM refuse (next n'a pas de champ
    // exports). Transformé par Vite, l'import se résout comme dans Next.
    server: { deps: { inline: ["@neon/auth"] } },
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
  },
});
