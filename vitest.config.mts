import { defineConfig } from "vitest/config";

// Variables des tests d'intégration (DATABASE_TEST_*) ; .env absent en CI, où elles viennent de l'environnement.
// Même logique que src/lib/load-env-file.ts, recopiée ici : le chargeur natif de Vite refuse l'import d'un .ts CommonJS.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
});
