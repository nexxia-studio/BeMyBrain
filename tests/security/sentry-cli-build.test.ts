// @vitest-environment node
import type { NextConfig } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Décision d'Antoine (2026-11-18) : ni CLI Sentry ni wizard. @sentry/nextjs 11.13.0 amène, par
// @sentry/bundler-plugins 11.13.0, le paquet `sentry` 0.49.0 (la CLI). Chemins par lesquels le build l'appelle :
// - Turbopack (notre build) : seul le hook `compiler.runAfterProductionCompile` (useRunAfterProductionCompileHook,
//   vrai par défaut sous Turbopack) charge le gestionnaire du plugin, puis createRelease, injectDebugIds,
//   uploadSourcemaps → `createSentrySDK` du paquet `sentry` (exécuté dans le processus, sans sous-processus).
// - createRelease lit SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT dans l'environnement : avec eux, sur un build
//   Vercel production, il pose set-commits et deploy par la CLI, même avec release.create et finalize à false.
// - Télémétrie active avec un sentryUrl autre que sentry.io : `sentry info` par la CLI (telemetry: false l'évite).
// - Webpack (`next build --webpack`, pas notre build) : le plugin webpack fait les mêmes appels.
// Le test exécute le vrai SDK et intercepte le chargement du module `sentry` et tout sous-processus.

type ModuleLoad = (
  request: string,
  parent: unknown,
  isMain: boolean,
) => unknown;
const moduleInternals = Module as unknown as { _load: ModuleLoad };
const originalLoad = moduleInternals._load;
const nodeRequire = createRequire(import.meta.url);
const childProcess = nodeRequire(
  "node:child_process",
) as typeof import("node:child_process");
const SUBPROCESS_FUNCTIONS = [
  "exec",
  "execFile",
  "execFileSync",
  "execSync",
  "fork",
  "spawn",
  "spawnSync",
] as const;

/** Appels faits au faux paquet `sentry` : chargements, créations de client, commandes. */
const cli = {
  loads: [] as string[],
  clients: [] as Record<string, unknown>[],
  commands: [] as string[],
};

/** Commande de la CLI (ex. « release.set-commits ») : enregistrée, rien n'est exécuté ni envoyé. */
function fakeCommand(path: string[]): unknown {
  return new Proxy(() => {}, {
    get: (_target, key) =>
      key === "then" ? undefined : fakeCommand([...path, String(key)]),
    apply: () => {
      cli.commands.push(path.join("."));
      return Promise.resolve(undefined);
    },
  });
}

const fakeSentryPackage = {
  createSentrySDK: (options: Record<string, unknown>) => {
    cli.clients.push(options);
    return fakeCommand([]);
  },
};

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
vi.mock("next-intl/plugin", () => ({
  default: () => (config: NextConfig) => config,
}));

const DSN = "https://clepublique@o1.ingest.de.sentry.io/42";
const originalArgv = process.argv;
let projectDir: string;
let subprocessSpies: ReturnType<typeof vi.spyOn>[];

/** Sous-processus lancés pendant le test, toutes fonctions de child_process confondues. */
function subprocessCalls(): unknown[][] {
  return subprocessSpies.flatMap((spy) => spy.mock.calls);
}

/** Lance la partie d'après compilation du build, comme le fait `next build` sous Turbopack. */
async function runAfterProductionCompile(config: NextConfig): Promise<void> {
  const hook = (
    config.compiler as
      | {
          runAfterProductionCompile?: (args: {
            distDir: string;
            projectDir: string;
          }) => Promise<void>;
        }
      | undefined
  )?.runAfterProductionCompile;
  await hook?.({ distDir: join(projectDir, ".next"), projectDir });
}

beforeEach(() => {
  cli.loads = [];
  cli.clients = [];
  cli.commands = [];
  // `require("sentry")` (et l'ancien `@sentry/cli`) détourné vers le faux paquet, sans réseau.
  // raccourci: Module._load est interne à Node (stable, patché par de nombreux outils) — passer à
  // module.registerHooks quand Node ≥ 22.15 sera garanti partout et que Vitest l'acceptera.
  vi.spyOn(moduleInternals, "_load").mockImplementation(function (
    this: unknown,
    request,
    parent,
    isMain,
  ) {
    if (request === "sentry" || request.startsWith("@sentry/cli")) {
      cli.loads.push(request);
      return fakeSentryPackage;
    }
    return originalLoad.call(this, request, parent, isMain);
  });
  subprocessSpies = SUBPROCESS_FUNCTIONS.map((name) =>
    vi.spyOn(childProcess, name),
  );

  // Build Vercel de production sous Turbopack (défaut de `next build` en Next 16), DSN valide.
  // Jeton, organisation et projet présents dans l'environnement : le pire cas, si quelqu'un les ajoute dans Vercel.
  projectDir = mkdtempSync(join(tmpdir(), "bemybrain-sentry-cli-"));
  mkdirSync(join(projectDir, "src", "app"), { recursive: true });
  mkdirSync(join(projectDir, ".next"), { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(projectDir);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("TURBOPACK", "auto");
  vi.stubEnv("SENTRY_DSN", DSN);
  // SHA fourni par Vercel : le SDK ne lance pas `git rev-parse` pour nommer la release.
  vi.stubEnv(
    "VERCEL_GIT_COMMIT_SHA",
    "0123456789abcdef0123456789abcdef01234567",
  );
  vi.stubEnv("VERCEL_GIT_REPO_OWNER", "proprietaire");
  vi.stubEnv("VERCEL_GIT_REPO_SLUG", "depot");
  vi.stubEnv("VERCEL_URL", "bemybrain.example.test");
  vi.stubEnv("SENTRY_AUTH_TOKEN", "sntrys_jeton_factice");
  vi.stubEnv("SENTRY_ORG", "organisation-factice");
  vi.stubEnv("SENTRY_PROJECT", "projet-factice");
  process.argv = [...originalArgv, "build"];
});

afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(projectDir, { recursive: true, force: true });
});

/** Charge next.config.ts avec le vrai SDK ; remplit sdk.options. */
async function loadConfig(): Promise<NextConfig> {
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  return config;
}

describe("CLI Sentry au build", () => {
  it("les options qui ouvrent un chemin vers la CLI sont verrouillées", async () => {
    await loadConfig();
    const options = sdk.options ?? {};

    // Le hook d'après compilation est le seul chemin vers la CLI sous Turbopack.
    expect(options).toHaveProperty("useRunAfterProductionCompileHook", false);
    expect(options).toHaveProperty("telemetry", false);
    expect(options.sourcemaps).toEqual({ disable: true });
    expect(options.release).toEqual({ create: false, finalize: false });
    // Pas de jeton, d'organisation, de projet ni de serveur Sentry dans le dépôt.
    for (const key of ["authToken", "org", "project", "sentryUrl"]) {
      expect(options).not.toHaveProperty(key);
    }
    // Pas de bascule vers webpack ni d'API d'upload à la main.
    expect(options).not.toHaveProperty("webpack");
    expect(options).not.toHaveProperty("errorHandler");
  });

  it("next.config.ts traité par le vrai SDK : aucun hook d'après compilation, ni CLI chargée, ni sous-processus", async () => {
    const config = await loadConfig();

    expect(config.compiler).not.toHaveProperty("runAfterProductionCompile");
    expect(config).not.toHaveProperty("webpack");
    await runAfterProductionCompile(config);

    expect(cli.loads).toEqual([]);
    expect(cli.clients).toEqual([]);
    expect(cli.commands).toEqual([]);
    expect(subprocessCalls()).toEqual([]);
  });

  it("témoin : hook réactivé (option retirée), le jeton de l'environnement suffit, la CLI pose commits et deploy", async () => {
    await loadConfig();
    const { useRunAfterProductionCompileHook, ...withoutHookOption } =
      sdk.options ?? {};
    void useRunAfterProductionCompileHook;

    const config = sdk.real!({}, withoutHookOption);
    await runAfterProductionCompile(config);

    expect(cli.loads).toContain("sentry");
    expect(cli.clients[0]).toMatchObject({ token: "sntrys_jeton_factice" });
    expect(cli.commands).toEqual(
      expect.arrayContaining(["release.set-commits", "release.deploy"]),
    );
  });

  it("témoin : hook réactivé avec source maps et création de release, la CLI crée la release et envoie les source maps", async () => {
    await loadConfig();
    const config = sdk.real!(
      {},
      {
        ...sdk.options,
        useRunAfterProductionCompileHook: true,
        authToken: "sntrys_autre_jeton_factice",
        sourcemaps: { disable: false },
        release: { create: true, finalize: true },
      },
    );
    await runAfterProductionCompile(config);

    // Pas de cli.loads ici : le cache CommonJS de Node garde `sentry` chargé par le témoin précédent.
    expect(cli.clients[0]).toMatchObject({
      token: "sntrys_autre_jeton_factice",
    });
    expect(cli.commands).toEqual(
      expect.arrayContaining([
        "release.create",
        "release.finalize",
        "sourcemap.upload",
      ]),
    );
  });
});
