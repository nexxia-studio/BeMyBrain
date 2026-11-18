// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assertSentryDsnAtBuild } from "./sentry-build-guard";

const DSN = "https://clepublique@o1.ingest.de.sentry.io/42";
const BUILD_ARGV = [
  "/usr/bin/node",
  "/vercel/path0/node_modules/next/dist/bin/next",
  "build",
];

describe("garde-fou SENTRY_DSN au build Vercel", () => {
  it.each(["production", "preview"])(
    "build Vercel %s sans SENTRY_DSN : erreur",
    (vercelEnv) => {
      expect(() =>
        assertSentryDsnAtBuild(
          { VERCEL: "1", VERCEL_ENV: vercelEnv },
          BUILD_ARGV,
        ),
      ).toThrow(/SENTRY_DSN absente/);
    },
  );

  it("build Vercel avec un DSN invalide : erreur, sans afficher la valeur", () => {
    const invalid = "https://clesecrete@o1.ingest.example.test/42";

    let message = "";
    try {
      assertSentryDsnAtBuild(
        { VERCEL: "1", VERCEL_ENV: "preview", SENTRY_DSN: invalid },
        BUILD_ARGV,
      );
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/SENTRY_DSN invalide/);
    expect(message).not.toContain("clesecrete");
    expect(message).not.toContain("example.test");
  });

  it("build Vercel avec un DSN https://*.sentry.io : rien", () => {
    expect(() =>
      assertSentryDsnAtBuild(
        { VERCEL: "1", VERCEL_ENV: "production", SENTRY_DSN: DSN },
        BUILD_ARGV,
      ),
    ).not.toThrow();
  });

  it("hors Vercel (local, CI) : rien, même sans DSN", () => {
    expect(() =>
      assertSentryDsnAtBuild({ VERCEL_ENV: "preview" }, BUILD_ARGV),
    ).not.toThrow();
  });

  it("vercel dev (VERCEL_ENV=development) : rien", () => {
    expect(() =>
      assertSentryDsnAtBuild(
        { VERCEL: "1", VERCEL_ENV: "development" },
        BUILD_ARGV,
      ),
    ).not.toThrow();
  });

  it.each(["dev", "start"])(
    "sur Vercel mais hors next build (next %s) : rien",
    (command) => {
      expect(() =>
        assertSentryDsnAtBuild({ VERCEL: "1", VERCEL_ENV: "preview" }, [
          "/usr/bin/node",
          "next",
          command,
        ]),
      ).not.toThrow();
    },
  );

  it("VERCEL=1, VERCEL_ENV absent, build : erreur", () => {
    expect(() =>
      assertSentryDsnAtBuild({ VERCEL: "1", SENTRY_DSN: DSN }, BUILD_ARGV),
    ).toThrow(/VERCEL_ENV/);
  });

  it("VERCEL_ENV inattendu : erreur, sans afficher la valeur", () => {
    let message = "";
    try {
      assertSentryDsnAtBuild(
        { VERCEL: "1", VERCEL_ENV: "valeurinattendue", SENTRY_DSN: DSN },
        BUILD_ARGV,
      );
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/VERCEL_ENV/);
    expect(message).not.toContain("valeurinattendue");
  });
});

describe("garde-fou CLI Sentry au build Vercel", () => {
  const SECRET_VALUE = "valeursecretefactice";

  /** Message d'erreur du garde-fou, vide s'il ne lève rien. */
  function guardMessage(
    extra: Parameters<typeof assertSentryDsnAtBuild>[0],
    argv: readonly string[] = BUILD_ARGV,
  ): string {
    try {
      assertSentryDsnAtBuild(
        { VERCEL: "1", VERCEL_ENV: "production", SENTRY_DSN: DSN, ...extra },
        argv,
      );
    } catch (error) {
      return (error as Error).message;
    }
    return "";
  }

  it.each([
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_RELEASE",
    "SENTRY_URL",
  ] as const)(
    "%s définie sur un build Vercel : erreur qui nomme la variable et renvoie à BRAIN-35, sans sa valeur",
    (name) => {
      const message = guardMessage({ [name]: SECRET_VALUE });

      expect(message).toContain(name);
      expect(message).toContain("BRAIN-35");
      expect(message).not.toContain(SECRET_VALUE);
    },
  );

  it.each(["production", "preview"])(
    "build Vercel %s lancé avec --webpack : erreur qui nomme --webpack",
    (vercelEnv) => {
      const message = guardMessage({ VERCEL_ENV: vercelEnv }, [
        ...BUILD_ARGV,
        "--webpack",
      ]);

      expect(message).toContain("--webpack");
      expect(message).toContain("BRAIN-35");
    },
  );

  it("variable Sentry vide sur un build Vercel : rien", () => {
    const message = guardMessage({ SENTRY_AUTH_TOKEN: "", SENTRY_URL: "" });

    expect(message).toBe("");
  });

  it.each([
    ["local ou CI (pas de VERCEL)", { VERCEL: undefined }, BUILD_ARGV],
    ["vercel dev", { VERCEL_ENV: "development" }, BUILD_ARGV],
    ["next dev sur Vercel", {}, ["/usr/bin/node", "next", "dev", "--webpack"]],
  ] as const)(
    "%s avec jeton Sentry et --webpack : rien",
    (_label, env, argv) => {
      const message = guardMessage(
        { ...env, SENTRY_AUTH_TOKEN: SECRET_VALUE },
        [...argv, "--webpack"],
      );

      expect(message).toBe("");
    },
  );
});
