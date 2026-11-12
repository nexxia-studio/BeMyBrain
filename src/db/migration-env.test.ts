// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseMigrationEnv, selectMigrationTarget } from "./migration-env";

describe("variables d'environnement des migrations", () => {
  it("les migrations exigent DATABASE_URL", () => {
    const parse = () => parseMigrationEnv({});

    expect(parse).toThrow(/DATABASE_URL/);
  });

  it("refuse DATABASE_URL et DATABASE_AUTHENTICATED_URL sur deux hôtes différents", () => {
    const source = {
      DATABASE_URL: "postgresql://owner:pw@ep-prod-1.db.example.test/app",
      DATABASE_AUTHENTICATED_URL:
        "postgresql://app:pw@ep-dev-2.db.example.test/app",
    };

    const parse = () => parseMigrationEnv(source);

    expect(parse).toThrow(/DATABASE_URL.*DATABASE_AUTHENTICATED_URL/);
    expect(parse).not.toThrow(/ep-|example/);
  });
});

describe("cible des migrations", () => {
  const source = {
    DATABASE_URL: "postgresql://owner:pw@ep-dev-1.db.example.test/app",
    DATABASE_AUTHENTICATED_URL:
      "postgresql://app:pw@ep-dev-1.db.example.test/app",
    DATABASE_TEST_URL: "postgresql://owner:pw@ep-test-2.db.example.test/app",
    DATABASE_TEST_AUTHENTICATED_URL:
      "postgresql://app:pw@ep-test-2.db.example.test/app",
  };

  it("sans MIGRATION_TARGET, migre la branche de DATABASE_URL", () => {
    const env = selectMigrationTarget(source);

    expect(env.DATABASE_URL).toBe(source.DATABASE_URL);
    expect(env.DATABASE_AUTHENTICATED_URL).toBe(
      source.DATABASE_AUTHENTICATED_URL,
    );
  });

  it("MIGRATION_TARGET=test migre la branche test avec ses deux connexions", () => {
    const env = selectMigrationTarget({ ...source, MIGRATION_TARGET: "test" });

    expect(env.DATABASE_URL).toBe(source.DATABASE_TEST_URL);
    expect(env.DATABASE_AUTHENTICATED_URL).toBe(
      source.DATABASE_TEST_AUTHENTICATED_URL,
    );
  });

  it("MIGRATION_TARGET=test sans DATABASE_TEST_URL est refusé au lieu de retomber sur dev", () => {
    const withoutTest = { ...source, DATABASE_TEST_URL: undefined };

    const select = () =>
      selectMigrationTarget({ ...withoutTest, MIGRATION_TARGET: "test" });

    expect(select).toThrow(/DATABASE_TEST_URL/);
    expect(select).not.toThrow(/ep-|example\.test|pw@/);
  });

  it("MIGRATION_TARGET=test sans DATABASE_TEST_AUTHENTICATED_URL est refusé", () => {
    const withoutTest = {
      ...source,
      DATABASE_TEST_AUTHENTICATED_URL: undefined,
    };

    const select = () =>
      selectMigrationTarget({ ...withoutTest, MIGRATION_TARGET: "test" });

    expect(select).toThrow(/DATABASE_TEST_AUTHENTICATED_URL/);
  });

  it("une MIGRATION_TARGET inconnue est refusée", () => {
    const select = () =>
      selectMigrationTarget({ ...source, MIGRATION_TARGET: "production" });

    expect(select).toThrow(/MIGRATION_TARGET/);
  });

  it("ne modifie pas l'objet d'origine", () => {
    const original = { ...source, MIGRATION_TARGET: "test" };

    selectMigrationTarget(original);

    expect(original.DATABASE_URL).toBe(source.DATABASE_URL);
  });
});
