// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Next 16.4.6 pose NEXT_PHASE=phase-production-build dans le processus de `next build` avant de lancer les workers
// de prérendu (next/dist/build/index.js, `process.env.NEXT_PHASE = PHASE_PRODUCTION_BUILD`, puis
// createStaticWorker), qui héritent de process.env (next/dist/lib/worker.js). Les configs serveur et edge doivent
// transmettre cette phase à sentryOptions : aucun Sentry.init pendant le build.

const init = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ init }));

const DSN = "https://clepublique@o1.ingest.de.sentry.io/42";
const CONFIGS = {
  serveur: () => import("../../sentry.server.config"),
  edge: () => import("../../sentry.edge.config"),
};

beforeEach(() => {
  init.mockClear();
  vi.resetModules();
  vi.stubEnv("SENTRY_DSN", DSN);
  vi.stubEnv("VERCEL_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config Sentry serveur et edge pendant le build", () => {
  it.each(Object.entries(CONFIGS))(
    "%s : pas d'initialisation pendant `next build`",
    async (_runtime, load) => {
      vi.stubEnv("NEXT_PHASE", "phase-production-build");

      await load();

      expect(init).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(CONFIGS))(
    "%s : initialisé hors build",
    async (_runtime, load) => {
      vi.stubEnv("NEXT_PHASE", undefined);

      await load();

      expect(init).toHaveBeenCalledOnce();
    },
  );
});
