import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SDK factice : la fabrique n'est appelée que si le module est réellement importé.
const sdk = vi.hoisted(() => ({
  // Mis à vrai par un test : le prochain import du SDK échoue (morceau introuvable).
  failNextImport: false,
  loaded: vi.fn(),
  init: vi.fn(),
  captureException: vi.fn(),
}));
// Fabrique réenregistrée à chaque chargement du module : `vi.resetModules` ne vide pas le registre des
// mocks, une fabrique enregistrée une fois ne serait plus jamais rappelée.
function mockSdk() {
  vi.doMock("@sentry/nextjs", () => {
    sdk.loaded();
    if (sdk.failNextImport) {
      sdk.failNextImport = false;
      throw new Error("morceau introuvable");
    }
    return { init: sdk.init, captureException: sdk.captureException };
  });
}

const DSN = "https://clepublique@o1.ingest.de.sentry.io/42";

// Chaque test recharge le module : les options sont lues à son évaluation, le SDK mémorisé.
async function loadModule(env: { SENTRY_DSN?: string; VERCEL_ENV?: string }) {
  vi.stubEnv("SENTRY_DSN", env.SENTRY_DSN);
  vi.stubEnv("VERCEL_ENV", env.VERCEL_ENV);
  vi.resetModules();
  mockSdk();
  return import("./sentry-client");
}

beforeEach(() => {
  sdk.failNextImport = false;
  sdk.loaded.mockClear();
  sdk.init.mockClear();
  sdk.captureException.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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

  it("import échoué puis nouvelle erreur : le SDK est rechargé et init n'est appelé qu'une fois", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { reportClientError } = await loadModule({
      SENTRY_DSN: DSN,
      VERCEL_ENV: "production",
    });
    sdk.failNextImport = true;

    reportClientError(new Error("première"));
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(sdk.init).not.toHaveBeenCalled();

    const second = new Error("seconde");
    reportClientError(second);
    await vi.waitFor(() =>
      expect(sdk.captureException).toHaveBeenCalledWith(second),
    );

    expect(sdk.loaded).toHaveBeenCalledTimes(2);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
  });

  it("un échec de captureException n'efface pas le SDK chargé (pas de rechargement)", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { reportClientError } = await loadModule({
      SENTRY_DSN: DSN,
      VERCEL_ENV: "production",
    });
    sdk.captureException.mockImplementationOnce(() => {
      throw new Error("capture en panne");
    });

    reportClientError(new Error("première"));
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    reportClientError(new Error("seconde"));
    await vi.waitFor(() =>
      expect(sdk.captureException).toHaveBeenCalledTimes(2),
    );

    expect(sdk.loaded).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });
});
