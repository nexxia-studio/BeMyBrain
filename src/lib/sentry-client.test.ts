import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SDK factice : la fabrique n'est appelée que si le module est réellement importé.
const sdk = vi.hoisted(() => ({
  loaded: vi.fn(),
  init: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => {
  sdk.loaded();
  return { init: sdk.init, captureException: sdk.captureException };
});

const DSN = "https://clepublique@o1.ingest.de.sentry.io/42";

// Chaque test recharge le module : les options sont lues à son évaluation, le SDK mémorisé.
async function loadModule(env: { SENTRY_DSN?: string; VERCEL_ENV?: string }) {
  vi.stubEnv("SENTRY_DSN", env.SENTRY_DSN);
  vi.stubEnv("VERCEL_ENV", env.VERCEL_ENV);
  vi.resetModules();
  return import("./sentry-client");
}

beforeEach(() => {
  sdk.loaded.mockClear();
  sdk.init.mockClear();
  sdk.captureException.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sentry navigateur, chargé à la demande", () => {
  it("inactif (sans DSN) : le SDK n'est jamais importé, ni au démarrage ni pour une erreur", async () => {
    const { loadSentry, reportClientError } = await loadModule({
      VERCEL_ENV: "production",
    });

    expect(loadSentry()).toBeUndefined();
    reportClientError(new Error("x"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sdk.loaded).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it("inactif hors production/preview, même avec un DSN", async () => {
    const { loadSentry } = await loadModule({
      SENTRY_DSN: DSN,
      VERCEL_ENV: "development",
    });

    expect(loadSentry()).toBeUndefined();
    expect(sdk.loaded).not.toHaveBeenCalled();
  });

  it("actif : importe le SDK et l'initialise une seule fois avec les options communes", async () => {
    const { loadSentry } = await loadModule({
      SENTRY_DSN: DSN,
      VERCEL_ENV: "preview",
    });

    await loadSentry();
    await loadSentry();

    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        dsn: DSN,
        environment: "preview",
      }),
    );
  });

  it("actif : une erreur est envoyée après l'initialisation du SDK", async () => {
    const { reportClientError } = await loadModule({
      SENTRY_DSN: DSN,
      VERCEL_ENV: "production",
    });
    const error = new Error("panne");

    reportClientError(error);

    await vi.waitFor(() =>
      expect(sdk.captureException).toHaveBeenCalledWith(error),
    );
    expect(sdk.init.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.captureException.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
