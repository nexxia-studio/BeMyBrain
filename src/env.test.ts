// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseAppEnv, parseMigrationEnv } from "./env";

const validAppEnv = {
  DATABASE_AUTHENTICATED_URL:
    "postgresql://app_role:secret-password@db.example.test/app",
  NEON_AUTH_BASE_URL: "https://auth.example.test/app/auth",
  NEON_AUTH_JWKS_URL:
    "https://auth.example.test/app/auth/.well-known/jwks.json",
};

describe("variables d'environnement", () => {
  it("refuse de démarrer si DATABASE_AUTHENTICATED_URL manque", () => {
    const source: Record<string, string | undefined> = {
      ...validAppEnv,
      DATABASE_AUTHENTICATED_URL: undefined,
    };

    const parse = () => parseAppEnv(source);

    expect(parse).toThrow(/DATABASE_AUTHENTICATED_URL/);
    expect(parse).not.toThrow(/https?:|postgres/);
  });

  it("n'affiche jamais la valeur d'une variable invalide", () => {
    const source = {
      ...validAppEnv,
      NEON_AUTH_JWKS_URL: "pas-une-url-secrete",
    };

    const parse = () => parseAppEnv(source);

    expect(parse).toThrow(/NEON_AUTH_JWKS_URL/);
    expect(parse).not.toThrow(/pas-une-url-secrete/);
  });

  it("l'app démarre sans l'URL propriétaire DATABASE_URL", () => {
    const env = parseAppEnv(validAppEnv);

    expect(env).not.toHaveProperty("DATABASE_URL");
  });

  it("les migrations exigent DATABASE_URL", () => {
    const parse = () => parseMigrationEnv({});

    expect(parse).toThrow(/DATABASE_URL/);
  });
});
