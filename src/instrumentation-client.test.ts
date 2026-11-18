import { afterEach, beforeEach, expect, it, vi } from "vitest";

const loadSentry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-client", () => ({ loadSentry }));

beforeEach(() => {
  vi.resetModules();
  loadSentry.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("au démarrage du navigateur, lance le chargement de Sentry (importé seulement s'il est actif)", async () => {
  await import("./instrumentation-client");

  expect(loadSentry).toHaveBeenCalledTimes(1);
});

it("import du SDK échoué au démarrage : une ligne en console, aucun rejet non géré", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  const failure = new Error("morceau introuvable");
  loadSentry.mockReturnValue(Promise.reject(failure));

  await import("./instrumentation-client");
  await new Promise((resolve) => setTimeout(resolve, 0));
  process.off("unhandledRejection", unhandled);

  expect(consoleError).toHaveBeenCalledTimes(1);
  expect(consoleError).toHaveBeenCalledWith(expect.any(String), failure);
  expect(unhandled).not.toHaveBeenCalled();
});
