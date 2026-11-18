// @vitest-environment node
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sentryDsnOrigin, sentryOptions } from "./sentry-options";

// DSN de forme réelle, sur un domaine réservé aux tests (aucun identifiant de notre projet Sentry).
const DSN = "https://cle-publique@o1.ingest.example.test/42";

function activeOptions() {
  return sentryOptions({ SENTRY_DSN: DSN, VERCEL_ENV: "preview" });
}

function eventWithPersonalData(): ErrorEvent {
  return {
    type: undefined,
    message: "panne",
    user: {
      id: "dc42fa70-09a7-4038-a3bb-f61dda854910",
      email: "antoine@example.test",
      ip_address: "203.0.113.7",
      username: "antoine",
    },
    request: {
      url: "https://app.example.test/reset-password?email=antoine%40example.test",
      method: "POST",
      data: { email: "antoine@example.test", password: "secret" },
      cookies: { "__Secure-neon-auth.session_token": "jeton" },
      query_string: "email=antoine%40example.test",
      headers: {
        Cookie: "__Secure-neon-auth.session_token=jeton",
        Authorization: "Bearer eyJjeton",
        "Set-Cookie": "NEXT_LOCALE=fr",
        "X-Forwarded-For": "203.0.113.7",
        "user-agent": "Safari",
      },
    },
    contexts: {
      nextjs: { request_path: "/reset-password?email=antoine%40example.test" },
    },
  };
}

describe("options communes de Sentry", () => {
  it("sendDefaultPii est faux et l'environnement vient de VERCEL_ENV", () => {
    const options = sentryOptions({
      SENTRY_DSN: DSN,
      VERCEL_ENV: "production",
    });

    expect(options.sendDefaultPii).toBe(false);
    expect(options.environment).toBe("production");
    expect(options.enabled).toBe(true);
    expect(options.dsn).toBe(DSN);
    expect(options.tracesSampleRate).toBe(0);
  });

  it.each([
    { SENTRY_DSN: undefined, VERCEL_ENV: "production" },
    { SENTRY_DSN: "", VERCEL_ENV: "preview" },
    { SENTRY_DSN: DSN, VERCEL_ENV: undefined },
    { SENTRY_DSN: DSN, VERCEL_ENV: "development" },
    { SENTRY_DSN: DSN, VERCEL_ENV: "Production" },
  ])(
    "sans SENTRY_DSN ou hors production/preview, Sentry est inactif (%o)",
    (env) => {
      const options = sentryOptions(env);

      expect(options.enabled).toBe(false);
      expect(options.dsn).toBeUndefined();
    },
  );

  it("beforeSend retire e-mail, corps, cookies, en-têtes d'auth et query string", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend(eventWithPersonalData());

    expect(sent).not.toBeNull();
    const serialized = JSON.stringify(sent);
    for (const leak of [
      "antoine@example.test",
      "antoine%40example.test",
      "secret",
      "jeton",
      "203.0.113.7",
      "NEXT_LOCALE",
    ]) {
      expect(serialized).not.toContain(leak);
    }
    expect(sent?.user).toEqual({ id: "dc42fa70-09a7-4038-a3bb-f61dda854910" });
    expect(sent?.request).not.toHaveProperty("data");
    expect(sent?.request).not.toHaveProperty("cookies");
    expect(sent?.request).not.toHaveProperty("query_string");
    expect(sent?.request?.url).toBe("https://app.example.test/reset-password");
    expect(sent?.request?.headers).toEqual({ "user-agent": "Safari" });
    expect(sent?.contexts?.nextjs).toEqual({ request_path: "/reset-password" });
  });

  it("beforeSendTransaction applique le même nettoyage", () => {
    const { beforeSendTransaction } = activeOptions();

    const sent = beforeSendTransaction({
      ...eventWithPersonalData(),
      type: "transaction",
    });

    expect(JSON.stringify(sent)).not.toContain("antoine@example.test");
    expect(sent?.request).not.toHaveProperty("cookies");
  });

  it("un événement sans requête ni utilisateur passe sans erreur", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({ type: undefined, message: "panne" });

    expect(sent).toEqual({ type: undefined, message: "panne" });
  });

  it("aucune intégration replay", () => {
    const options = activeOptions();
    const clientConfig = readFileSync(
      join(process.cwd(), "src/instrumentation-client.ts"),
      "utf8",
    );

    expect(options).not.toHaveProperty("integrations");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
    expect(clientConfig.toLowerCase()).not.toContain("replay");
  });
});

describe("fil d'Ariane envoyé à Sentry", () => {
  it.each(["ui.input", "console"])(
    "un fil de catégorie %s ne garde ni message ni donnée",
    (category) => {
      const { beforeBreadcrumb } = activeOptions();
      const breadcrumb: Breadcrumb = {
        category,
        level: "log",
        message: "antoine@example.test",
        data: { arguments: ["antoine@example.test"] },
      };

      const kept = beforeBreadcrumb(breadcrumb);

      expect(JSON.stringify(kept ?? {})).not.toContain("antoine");
    },
  );

  it.each(["fetch", "xhr", "navigation"])(
    "un fil %s perd la query string de ses URL",
    (category) => {
      const { beforeBreadcrumb } = activeOptions();

      const kept = beforeBreadcrumb({
        category,
        data: {
          url: "/api/x?email=antoine%40example.test",
          from: "/reset-password?email=antoine%40example.test",
          to: "/login?next=%2Fdashboard",
          method: "GET",
        },
      });

      expect(kept?.data).toEqual({
        url: "/api/x",
        from: "/reset-password",
        to: "/login",
        method: "GET",
      });
    },
  );

  it("un clic garde son sélecteur", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "ui.click",
      message: "main > button",
    });

    expect(kept?.message).toBe("main > button");
  });
});

describe("origine du DSN pour la CSP", () => {
  it("renvoie l'origine https du DSN, sans la clé", () => {
    expect(sentryDsnOrigin(DSN)).toBe("https://o1.ingest.example.test");
  });

  it.each([
    undefined,
    "",
    "pas une url",
    "http://cle@o1.ingest.example.test/42",
    "javascript:alert(1)",
  ])("rien pour une valeur absente, invalide ou non https (%s)", (dsn) => {
    expect(sentryDsnOrigin(dsn)).toBeUndefined();
  });
});
