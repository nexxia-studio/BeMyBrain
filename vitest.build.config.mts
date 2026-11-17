import { defineConfig } from "vitest/config";

// Tests de la build de production (`pnpm test:build`, après `next build`) : hors de `pnpm test`, qui ne
// construit rien. Lit seulement le dossier .next, aucune variable d'environnement.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/build/**/*.test.ts"],
  },
});
