// @vitest-environment node
import type { NextConfig } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Vrai withSentryConfig du SDK, enveloppé pour lire les options passées par next.config.ts.
const sdk = vi.hoisted(() => ({
  options: undefined as Record<string, unknown> | undefined,
  real: undefined as
    | ((config: NextConfig, options: Record<string, unknown>) => NextConfig)
    | undefined,
}));
vi.mock("@sentry/nextjs/config", async (importActual) => {
  const actual = await importActual<typeof import("@sentry/nextjs/config")>();
  sdk.real = actual.withSentryConfig as typeof sdk.real;
  return {
    withSentryConfig: (
      config: NextConfig,
      options: Record<string, unknown>,
    ) => {
      sdk.options = { ...options };
      return actual.withSentryConfig(config, options);
    },
  };
});
// next-intl hors sujet ici : son plugin lit lui aussi le dossier courant au build.
vi.mock("next-intl/plugin", () => ({
  default: () => (config: NextConfig) => config,
}));

const DSN = "https://clepublique@o1.ingest.de.sentry.io/42";
const ENVELOPE = "application/x-sentry-envelope";
const originalArgv = process.argv;
let projectDir: string;

/** Fichiers et dossiers dont le nom contient « sentry-tunnel », dans tout le projet temporaire. */
function tunnelFiles(): string[] {
  return readdirSync(projectDir, { recursive: true, encoding: "utf8" }).filter(
    (entry) => entry.includes("sentry-tunnel"),
  );
}

/** Réécritures de la config finale, toutes phases confondues, sérialisées. */
async function rewritesText(config: NextConfig): Promise<string> {
  return JSON.stringify((await config.rewrites?.()) ?? []);
}

beforeEach(() => {
  // Build Vercel de preview simulé : mêmes conditions que setUpManagedTunnelVercelRoute du SDK.
  projectDir = mkdtempSync(join(tmpdir(), "bemybrain-sentry-tunnel-"));
  mkdirSync(join(projectDir, "src", "app"), { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(projectDir);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("SENTRY_DSN", DSN);
  // Posée par `next build` (Turbopack, défaut de Next 16) avant de lire next.config.ts ; exigée par le garde-fou.
  vi.stubEnv("TURBOPACK", "auto");
  process.argv = [...originalArgv, "build"];
});

afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(projectDir, { recursive: true, force: true });
});

describe("relais Sentry sur un build Vercel", () => {
  it("next.config.ts traité par le vrai SDK : aucune route sentry-tunnel ni réécriture d'enveloppe", async () => {
    vi.resetModules();

    const { default: config } = await import("../../next.config");

    expect(tunnelFiles()).toEqual([]);
    expect(await rewritesText(config)).not.toContain(ENVELOPE);
  });

  it("témoin : mêmes options sans tunnelRoute, le SDK crée la route et la réécriture", async () => {
    vi.resetModules();
    // Réimport ici : après resetModules, le mock ne rejoue pas la capture des options ; c'est ce chargement qui remplit sdk.options.
    await import("../../next.config");
    const { tunnelRoute, ...withoutTunnelRoute } = sdk.options ?? {};
    void tunnelRoute;

    const config = sdk.real!({}, withoutTunnelRoute);

    expect(tunnelFiles()).not.toEqual([]);
    expect(await rewritesText(config)).toContain(ENVELOPE);
  });
});
