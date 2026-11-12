// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseAppEnv, parseAuthEnv } from "./env";

const validAppEnv = {
  DATABASE_AUTHENTICATED_URL:
    "postgresql://app_role:secret-password@ep-test-123.db.example.test/app",
  NEON_AUTH_BASE_URL: "https://auth.example.test/app/auth",
  NEON_AUTH_JWKS_URL:
    "https://auth.example.test/app/auth/.well-known/jwks.json",
  NEON_AUTH_ISSUER: "https://auth.example.test",
  NEON_AUTH_AUDIENCE: "https://auth.example.test",
};

const validAuthEnv = {
  NEON_AUTH_BASE_URL: "https://auth.example.test/app/auth",
  NEON_AUTH_COOKIE_SECRET: "s".repeat(32),
};

describe("variables d'environnement de l'app", () => {
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

  it("refuse un JWKS servi en http", () => {
    const source = {
      ...validAppEnv,
      NEON_AUTH_JWKS_URL: "http://auth.example.test/.well-known/jwks.json",
    };

    const parse = () => parseAppEnv(source);

    expect(parse).toThrow(/NEON_AUTH_JWKS_URL/);
  });

  it("refuse une URL de base Neon Auth en http", () => {
    const source = {
      ...validAppEnv,
      NEON_AUTH_BASE_URL: "http://auth.example.test/app/auth",
    };

    const parse = () => parseAppEnv(source);

    expect(parse).toThrow(/NEON_AUTH_BASE_URL/);
  });

  it("refuse DATABASE_URL et DATABASE_AUTHENTICATED_URL sur deux hôtes différents", () => {
    const source = {
      ...validAppEnv,
      DATABASE_URL: "postgresql://owner:pw@ep-autre-456.db.example.test/app",
    };

    const parse = () => parseAppEnv(source);

    expect(parse).toThrow(/DATABASE_URL.*DATABASE_AUTHENTICATED_URL/);
    expect(parse).not.toThrow(/ep-|example/);
  });

  it("accepte le même hôte, avec ou sans -pooler", () => {
    const source = {
      ...validAppEnv,
      DATABASE_URL:
        "postgresql://owner:pw@ep-test-123-pooler.db.example.test/app",
    };

    const parse = () => parseAppEnv(source);

    expect(parse).not.toThrow();
  });

  it("refuse de démarrer sur Vercel si DATABASE_URL est définie", () => {
    const source = {
      ...validAppEnv,
      VERCEL: "1",
      DATABASE_URL: "postgresql://owner:pw@ep-test-123.db.example.test/app",
    };

    const parse = () => parseAppEnv(source);

    expect(parse).toThrow(/DATABASE_URL/);
    expect(parse).not.toThrow(/ep-|example|postgres/);
  });

  it.each(["NEON_AUTH_ISSUER", "NEON_AUTH_AUDIENCE"])(
    "refuse de démarrer si %s manque",
    (name) => {
      const source: Record<string, string | undefined> = {
        ...validAppEnv,
        [name]: undefined,
      };

      const parse = () => parseAppEnv(source);

      expect(parse).toThrow(new RegExp(name));
    },
  );

  it.each(["NEON_AUTH_ISSUER", "NEON_AUTH_AUDIENCE"])(
    "refuse %s en http",
    (name) => {
      const source = { ...validAppEnv, [name]: "http://auth.example.test" };

      const parse = () => parseAppEnv(source);

      expect(parse).toThrow(new RegExp(name));
    },
  );
});

describe("variables d'environnement de l'auth", () => {
  it("accepte l'URL Neon Auth et un secret de cookie de 32 caractères", () => {
    const env = parseAuthEnv(validAuthEnv);

    expect(env.NEON_AUTH_BASE_URL).toBe(validAuthEnv.NEON_AUTH_BASE_URL);
  });

  it("n'exige pas la connexion à la base", () => {
    const parse = () => parseAuthEnv(validAuthEnv);

    expect(parse).not.toThrow();
  });

  it("refuse un secret de cookie de moins de 32 caractères, sans l'afficher", () => {
    const source = {
      ...validAuthEnv,
      NEON_AUTH_COOKIE_SECRET: "secret-trop-court",
    };

    const parse = () => parseAuthEnv(source);

    expect(parse).toThrow(/NEON_AUTH_COOKIE_SECRET/);
    expect(parse).not.toThrow(/secret-trop-court/);
  });

  it("refuse de démarrer si NEON_AUTH_COOKIE_SECRET manque", () => {
    const source = { ...validAuthEnv, NEON_AUTH_COOKIE_SECRET: undefined };

    const parse = () => parseAuthEnv(source);

    expect(parse).toThrow(/NEON_AUTH_COOKIE_SECRET/);
  });

  it("refuse une URL Neon Auth en http", () => {
    const source = {
      ...validAuthEnv,
      NEON_AUTH_BASE_URL: "http://auth.example.test/app/auth",
    };

    const parse = () => parseAuthEnv(source);

    expect(parse).toThrow(/NEON_AUTH_BASE_URL/);
  });
});
