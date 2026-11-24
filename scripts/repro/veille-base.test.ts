// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  parseArgs,
  resolveSuspendConfig,
  resolveTarget,
} from "./veille-base.mjs";

// Script de reproduction BRAIN-50 (docs/runbooks/veille-base.md) : seules ses gardes sont testées ici.
// Aucun test n'appelle l'API Neon ni la base. Hôtes factices en example.test.

const PRODUCTION_HOST = "ep-prod-123.eu-central-1.aws.example.test";
const TEST_URL =
  "postgresql://app_backend:motdepasse@ep-test-456-pooler.eu-central-1.aws.example.test/neondb";
const DEV_URL =
  "postgresql://app_backend:motdepasse@ep-dev-789.eu-central-1.aws.example.test/neondb";
const PRODUCTION_URL = `postgresql://app_backend:motdepasse@ep-prod-123-pooler.eu-central-1.aws.example.test/neondb`;

const SECRETS = /motdepasse|example\.test|ep-|cle-secrete|projet-42/;

describe("arguments du script de reproduction", () => {
  it("prend par défaut la coupure par pg_terminate_backend sur la branche test", () => {
    const args = parseArgs([]);

    expect(args).toEqual({ mode: "terminate", branch: "test" });
  });

  it("lit le mode suspend et la branche dev, dans n'importe quel ordre", () => {
    const args = parseArgs(["--branch", "dev", "--suspend"]);

    expect(args).toEqual({ mode: "suspend", branch: "dev" });
  });

  it("refuse les deux modes à la fois", () => {
    const parse = () => parseArgs(["--terminate", "--suspend"]);

    expect(parse).toThrow(/--terminate.*--suspend/);
  });

  it("refuse une branche autre que test ou dev, production comprise", () => {
    const parse = () => parseArgs(["--branch", "production"]);

    expect(parse).toThrow(/--branch.*test.*dev/);
  });

  it("refuse --branch sans valeur", () => {
    const parse = () => parseArgs(["--branch"]);

    expect(parse).toThrow(/--branch/);
  });

  it("refuse un argument inconnu en rappelant l'usage", () => {
    const parse = () => parseArgs(["--vite"]);

    expect(parse).toThrow(/Usage/);
  });
});

describe("cible de la reproduction", () => {
  it("vise l'endpoint direct (sans -pooler) de la branche test", () => {
    const target = resolveTarget(
      {
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
        DATABASE_TEST_AUTHENTICATED_URL: TEST_URL,
      },
      "test",
    );

    expect(new URL(target).hostname).toBe(
      "ep-test-456.eu-central-1.aws.example.test",
    );
  });

  it("lit DATABASE_AUTHENTICATED_URL pour la branche dev", () => {
    const target = resolveTarget(
      {
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
        DATABASE_AUTHENTICATED_URL: DEV_URL,
      },
      "dev",
    );

    expect(new URL(target).hostname).toBe(
      "ep-dev-789.eu-central-1.aws.example.test",
    );
  });

  it("refuse une URL qui vise la production, sans citer l'hôte ni l'URL", () => {
    const resolve = () =>
      resolveTarget(
        {
          NEON_PRODUCTION_HOST: PRODUCTION_HOST,
          DATABASE_AUTHENTICATED_URL: PRODUCTION_URL,
        },
        "dev",
      );

    expect(resolve).toThrow(/DATABASE_AUTHENTICATED_URL.*NEON_PRODUCTION_HOST/);
    expect(resolve).not.toThrow(SECRETS);
  });

  it.each([
    ["avec un segment c-N", "ep-prod-123.c-2.eu-central-1.aws.example.test"],
    [
      "dans une autre région écrite",
      "ep-prod-123-pooler.eu-central-1.example.test",
    ],
  ])(
    "refuse une URL dont l'id d'endpoint est celui de la production, hôte écrit autrement (%s)",
    (_, host) => {
      const resolve = () =>
        resolveTarget(
          {
            NEON_PRODUCTION_HOST: PRODUCTION_HOST,
            DATABASE_TEST_AUTHENTICATED_URL: `postgresql://u:motdepasse@${host}/neondb`,
          },
          "test",
        );

      expect(resolve).toThrow(/NEON_PRODUCTION_HOST/);
      expect(resolve).not.toThrow(SECRETS);
    },
  );

  it("refuse de tourner sans NEON_PRODUCTION_HOST", () => {
    const resolve = () =>
      resolveTarget({ DATABASE_TEST_AUTHENTICATED_URL: TEST_URL }, "test");

    expect(resolve).toThrow(/NEON_PRODUCTION_HOST/);
  });

  it("refuse de tourner sur GitHub Actions ou Vercel", () => {
    const resolve = () =>
      resolveTarget(
        {
          VERCEL: "1",
          NEON_PRODUCTION_HOST: PRODUCTION_HOST,
          DATABASE_TEST_AUTHENTICATED_URL: TEST_URL,
        },
        "test",
      );

    expect(resolve).toThrow(/local/);
  });

  it("nomme la variable manquante de la branche visée", () => {
    const resolve = () =>
      resolveTarget({ NEON_PRODUCTION_HOST: PRODUCTION_HOST }, "test");

    expect(resolve).toThrow(/DATABASE_TEST_AUTHENTICATED_URL/);
  });
});

describe("configuration de la mise en veille (--suspend)", () => {
  const target =
    "postgresql://u:motdepasse@ep-test-456.eu-central-1.aws.example.test/neondb";

  it("nomme toutes les variables manquantes, sans afficher aucune valeur", () => {
    const resolve = () =>
      resolveSuspendConfig({ NEON_API_KEY: "cle-secrete" }, target);

    expect(resolve).toThrow(/NEON_PROJECT_ID.*NEON_ENDPOINT_ID/);
    expect(resolve).not.toThrow(/NEON_API_KEY/);
    expect(resolve).not.toThrow(SECRETS);
  });

  it("refuse un NEON_ENDPOINT_ID qui n'est pas l'endpoint de la branche visée, sans citer de valeur", () => {
    const resolve = () =>
      resolveSuspendConfig(
        {
          NEON_PRODUCTION_HOST: PRODUCTION_HOST,
          NEON_API_KEY: "cle-secrete",
          NEON_PROJECT_ID: "projet-42",
          NEON_ENDPOINT_ID: "ep-autre-000",
        },
        target,
      );

    expect(resolve).toThrow(/NEON_ENDPOINT_ID/);
    expect(resolve).not.toThrow(SECRETS);
  });

  it.each([
    [
      "sans -pooler ni segment c-N",
      "ep-prod-123.eu-central-1.aws.example.test",
    ],
    ["avec -pooler", "ep-prod-123-pooler.eu-central-1.aws.example.test"],
    ["avec un segment c-N", "ep-prod-123.c-2.eu-central-1.aws.example.test"],
    [
      "avec -pooler et un segment c-N",
      "ep-prod-123-pooler.c-2.eu-central-1.aws.example.test",
    ],
  ])(
    "refuse de mettre en veille l'endpoint de production même si l'hôte est écrit autrement (%s)",
    (_, productionTarget) => {
      const resolve = () =>
        resolveSuspendConfig(
          {
            NEON_PRODUCTION_HOST: PRODUCTION_HOST,
            NEON_API_KEY: "cle-secrete",
            NEON_PROJECT_ID: "projet-42",
            NEON_ENDPOINT_ID: "ep-prod-123",
          },
          `postgresql://u:motdepasse@${productionTarget}/neondb`,
        );

      expect(resolve).toThrow(/NEON_ENDPOINT_ID.*NEON_PRODUCTION_HOST/);
      expect(resolve).not.toThrow(SECRETS);
    },
  );

  it("refuse la mise en veille sans NEON_PRODUCTION_HOST", () => {
    const resolve = () =>
      resolveSuspendConfig(
        {
          NEON_API_KEY: "cle-secrete",
          NEON_PROJECT_ID: "projet-42",
          NEON_ENDPOINT_ID: "ep-test-456",
        },
        target,
      );

    expect(resolve).toThrow(/NEON_PRODUCTION_HOST/);
  });

  it("rend la configuration quand l'endpoint est celui de la branche visée", () => {
    const config = resolveSuspendConfig(
      {
        NEON_PRODUCTION_HOST: PRODUCTION_HOST,
        NEON_API_KEY: "cle-secrete",
        NEON_PROJECT_ID: "projet-42",
        NEON_ENDPOINT_ID: "EP-test-456",
      },
      target,
    );

    expect(config).toEqual({
      apiKey: "cle-secrete",
      projectId: "projet-42",
      endpointId: "ep-test-456",
    });
  });
});
