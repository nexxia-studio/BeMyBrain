import { defineConfig } from "vitest/config";

// Variables des tests d'intégration (DATABASE_TEST_*) ; .env absent en CI, où elles viennent de l'environnement.
// Même logique que src/lib/load-env-file.ts, recopiée ici : le chargeur natif de Vite refuse l'import d'un .ts CommonJS.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
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
