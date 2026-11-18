import { expect, it, vi } from "vitest";

const loadSentry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-client", () => ({ loadSentry }));

it("au démarrage du navigateur, lance le chargement de Sentry (importé seulement s'il est actif)", async () => {
  await import("./instrumentation-client");

  expect(loadSentry).toHaveBeenCalledTimes(1);
});
