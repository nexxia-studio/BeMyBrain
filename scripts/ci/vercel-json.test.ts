// @vitest-environment node
// Verrou sur vercel.json : le déploiement git de main est coupé, seule la CI déploie la production (BRAIN-37).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("vercel.json", () => {
  it("deploymentEnabled vaut false pour main et pour **", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
    ) as {
      git: { deploymentEnabled: Record<string, boolean> };
    };
    expect(config.git.deploymentEnabled.main).toBe(false);
    expect(config.git.deploymentEnabled["**"]).toBe(false);
  });
});
