// @vitest-environment node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { childTargetRefusal } from "./child-guard";

// Les enfants tsx refusent, avant toute connexion, un lancement sans marqueur ou une cible de production.
// Aucune base n'est touchée ici : les URL sont factices, et un refus arrive avant la première connexion.

const PRODUCTION_HOST = "ep-prod-456.eu-central-1.aws.neon.tech";
const PRODUCTION_URL = `postgresql://owner:secret@ep-prod-456-pooler.eu-central-1.aws.neon.tech/neondb`;
const OTHER_URL = `postgresql://owner:secret@ep-test-123.eu-central-1.aws.neon.tech/neondb`;
const guard = { marker: "SEED_CHILD", urlVariable: "DATABASE_URL" };

describe("garde des enfants tsx", () => {
  it("refuse sans le marqueur posé par le lanceur", () => {
    const refusal = childTargetRefusal(
      { DATABASE_URL: OTHER_URL, NEON_PRODUCTION_HOST: PRODUCTION_HOST },
      guard,
    );

    expect(refusal).toMatch(/SEED_CHILD=1/);
  });

  it("refuse l'hôte de production, sans citer d'hôte ni d'URL", () => {
    const refusal = childTargetRefusal(
      {
        SEED_CHILD: "1",
        DATABASE_URL: PRODUCTION_URL,
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
      },
      guard,
    );

    expect(refusal).toMatch(/NEON_PRODUCTION_HOST/);
    expect(refusal).not.toMatch(/ep-prod|secret/);
  });

  it("refuse l'endpoint de production écrit avec un autre hôte (segment c-N)", () => {
    const refusal = childTargetRefusal(
      {
        FROZEN_POOL_CHILD: "1",
        FROZEN_POOL_URL:
          "postgresql://app:secret@ep-prod-456.c-2.eu-central-1.aws.neon.tech/neondb",
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
      },
      { marker: "FROZEN_POOL_CHILD", urlVariable: "FROZEN_POOL_URL" },
    );

    expect(refusal).toMatch(/endpoint de NEON_PRODUCTION_HOST/);
  });

  it("refuse en local sans NEON_PRODUCTION_HOST", () => {
    const refusal = childTargetRefusal(
      { SEED_CHILD: "1", DATABASE_URL: OTHER_URL },
      guard,
    );

    expect(refusal).toMatch(/NEON_PRODUCTION_HOST manquante/);
  });

  it("accepte une autre branche avec le marqueur", () => {
    const refusal = childTargetRefusal(
      {
        SEED_CHILD: "1",
        DATABASE_URL: OTHER_URL,
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
      },
      guard,
    );

    expect(refusal).toBeUndefined();
  });
});

const ROOT = join(import.meta.dirname, "../..");

/** Lance un enfant sous tsx ; rend code de sortie, stdout et stderr. */
function runChild(file: string, args: string[], env: Record<string, string>) {
  const proc = spawn(process.execPath, ["--import", "tsx", file, ...args], {
    cwd: ROOT,
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
  proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  const killer = setTimeout(() => proc.kill("SIGKILL"), 25_000);
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) =>
      proc.once("close", (code) => {
        clearTimeout(killer);
        resolve({ code, stdout, stderr });
      }),
  );
}

const CHILDREN = [
  {
    file: "tests/factories/seed-child.mts",
    args: ["concurrent", randomUUID()],
    marker: "SEED_CHILD",
    urlVariable: "DATABASE_URL",
  },
  {
    file: "tests/factories/frozen-pool-child.mts",
    args: [join(ROOT, "déclencheur-inexistant")],
    marker: "FROZEN_POOL_CHILD",
    urlVariable: "FROZEN_POOL_URL",
  },
];

describe.each(CHILDREN)(
  "$file lancé hors de son lanceur",
  ({ file, args, marker, urlVariable }) => {
    it("sort en code 2 sans rien écrire sur stdout quand la cible est la production", async () => {
      const result = await runChild(file, args, {
        [marker]: "1",
        [urlVariable]: PRODUCTION_URL,
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
      });

      expect(result.code).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/NEON_PRODUCTION_HOST/);
      expect(result.stderr).not.toMatch(/ep-prod|secret/);
    }, 30_000);

    it("sort en code 2 sans rien écrire sur stdout sans le marqueur", async () => {
      const result = await runChild(file, args, {
        [urlVariable]: OTHER_URL,
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
      });

      expect(result.code).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(new RegExp(`${marker}=1`));
    }, 30_000);
  },
);
