// @vitest-environment node
// Verrou sur vercel.json : le déploiement git est coupé pour toutes les branches, main comprise ;
// seule la CI déploie (BRAIN-37). Contenu comparé en entier : toute autre clé fait échouer le test.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("vercel.json", () => {
  it("coupe le déploiement git pour main et pour ** et ne contient rien d'autre", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
    );

    expect(config).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      git: { deploymentEnabled: { main: false, "**": false } },
    });
  });
});
