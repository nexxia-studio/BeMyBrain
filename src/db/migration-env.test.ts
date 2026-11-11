// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseMigrationEnv } from "./migration-env";

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
