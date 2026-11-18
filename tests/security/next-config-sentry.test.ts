// @vitest-environment node
import type { NextConfig } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// withSentryConfig remplacé par un témoin : on lit les options réellement passées par next.config.ts.
const withSentryConfig = vi.hoisted(() =>
  vi.fn((config: NextConfig, options: Record<string, unknown>) => {
    void options;
    return config;
  }),
);
vi.mock("@sentry/nextjs/config", () => ({ withSentryConfig }));

async function loadConfig() {
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  const options = withSentryConfig.mock.lastCall?.[1];
  if (!options) throw new Error("withSentryConfig non appelé");
  return { config, options };
}

beforeEach(() => {
  withSentryConfig.mockClear();
  vi.stubEnv("SENTRY_DSN", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("build Sentry de next.config", () => {
  it("n'ouvre aucun tunnel : pas de route publique de relais sur notre domaine", async () => {
    const { options } = await loadConfig();

    expect(options).not.toHaveProperty("tunnelRoute");
  });

  it("n'envoie rien au build : ni source maps, ni release, ni télémétrie", async () => {
    const { options } = await loadConfig();

    expect(options.sourcemaps).toMatchObject({ disable: true });
    expect(options.release).toMatchObject({ create: false });
    expect(options.telemetry).toBe(false);
  });

  it("n'expose au bundle que SENTRY_DSN et VERCEL_ENV, quand ils sont définis", async () => {
    vi.stubEnv("SENTRY_DSN", "https://cle@o1.ingest.example.test/42");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("SENTRY_AUTH_TOKEN", "jeton-secret");

    const { config } = await loadConfig();

    expect(config.env).toEqual({
      SENTRY_DSN: "https://cle@o1.ingest.example.test/42",
      VERCEL_ENV: "preview",
    });
  });

  it("sans les variables, la clé env est vide", async () => {
    const { config } = await loadConfig();

    expect(config.env).toEqual({});
  });
});
