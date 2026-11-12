// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assertNotProductionTarget } from "./production-guard";

const PROD_HOST = "ep-prod-111.eu-central-1.db.example.test";
const DEV_URL =
  "postgresql://owner:pw@ep-dev-222.eu-central-1.db.example.test/app";

describe("garde-fou contre la production", () => {
  it("refuse une migration locale qui vise la production", () => {
    const env = {
      DATABASE_URL: `postgresql://owner:pw@${PROD_HOST}/app`,
      NEON_PRODUCTION_HOST: PROD_HOST,
    };

    const check = () => assertNotProductionTarget(env);

    expect(check).toThrow(/DATABASE_URL.*NEON_PRODUCTION_HOST/);
    expect(check).not.toThrow(/ep-|example/);
  });

  it("refuse la production même via l'hôte -pooler", () => {
    const env = {
      DATABASE_URL:
        "postgresql://owner:pw@ep-prod-111-pooler.eu-central-1.db.example.test/app",
      NEON_PRODUCTION_HOST: PROD_HOST,
    };

    const check = () => assertNotProductionTarget(env);

    expect(check).toThrow(/NEON_PRODUCTION_HOST/);
  });

  it("refuse en local si NEON_PRODUCTION_HOST manque", () => {
    const env = { DATABASE_URL: DEV_URL };

    const check = () => assertNotProductionTarget(env);

    expect(check).toThrow(/NEON_PRODUCTION_HOST/);
  });

  it("autorise une branche de dev en local", () => {
    const env = { DATABASE_URL: DEV_URL, NEON_PRODUCTION_HOST: PROD_HOST };

    const check = () => assertNotProductionTarget(env);

    expect(check).not.toThrow();
  });

  it("autorise GitHub Actions sans NEON_PRODUCTION_HOST", () => {
    const env = {
      DATABASE_URL: `postgresql://owner:pw@${PROD_HOST}/app`,
      GITHUB_ACTIONS: "true",
    };

    const check = () => assertNotProductionTarget(env);

    expect(check).not.toThrow();
  });

  it("autorise le build Vercel", () => {
    const env = {
      DATABASE_URL: `postgresql://owner:pw@${PROD_HOST}/app`,
      VERCEL: "1",
    };

    const check = () => assertNotProductionTarget(env);

    expect(check).not.toThrow();
  });

  it("n'affiche pas l'URL quand DATABASE_URL est illisible", () => {
    const env = {
      DATABASE_URL: "pas-une-url-secrete",
      NEON_PRODUCTION_HOST: PROD_HOST,
    };

    const check = () => assertNotProductionTarget(env);

    expect(check).toThrow(/DATABASE_URL/);
    expect(check).not.toThrow(/pas-une-url-secrete/);
  });

  it("ne fait plus confiance à CI seule", () => {
    const env = {
      DATABASE_URL: `postgresql://owner:pw@${PROD_HOST}/app`,
      CI: "true",
    };

    const check = () => assertNotProductionTarget(env);

    expect(check).toThrow(/NEON_PRODUCTION_HOST/);
  });

  it.each([
    ["une URL complète", `postgresql://owner:pw@${PROD_HOST}/app`],
    ["un identifiant", `owner@${PROD_HOST}`],
    ["un chemin", `${PROD_HOST}/app`],
  ])("refuse NEON_PRODUCTION_HOST qui contient %s", (_label, value) => {
    const env = { DATABASE_URL: DEV_URL, NEON_PRODUCTION_HOST: value };

    const check = () => assertNotProductionTarget(env);

    expect(check).toThrow(/NEON_PRODUCTION_HOST/);
    expect(check).not.toThrow(/ep-prod|example\.test|owner/);
  });
});
