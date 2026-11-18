// @vitest-environment node
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sentryDsnOrigin, sentryOptions } from "./sentry-options";

// DSN de forme réelle sur sentry.io (seule origine admise), avec une clé et un projet fictifs.
const DSN = "https://clepublique@o1.ingest.de.sentry.io/42";

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
  it("l'environnement vient de VERCEL_ENV et le DSN n'est posé qu'actif", () => {
    const options = sentryOptions({
      SENTRY_DSN: DSN,
      VERCEL_ENV: "production",
    });

    expect(options.environment).toBe("production");
    expect(options.enabled).toBe(true);
    expect(options.dsn).toBe(DSN);
  });

  it("DSN valide sur sentry.io : Sentry est actif avec ce DSN", () => {
    const options = sentryOptions({ SENTRY_DSN: DSN, VERCEL_ENV: "preview" });

    expect(options.enabled).toBe(true);
    expect(options.dsn).toBe(DSN);
  });

  it.each([
    "pas une url",
    "http://clepublique@o1.ingest.sentry.io/42",
    "https://clepublique@o1.ingest.example.test/42",
    "https://clepublique@evilsentry.io/42",
  ])(
    "DSN hors sentry.io ou non https : Sentry est inactif, même règle que la CSP (%s)",
    (dsn) => {
      const options = sentryOptions({
        SENTRY_DSN: dsn,
        VERCEL_ENV: "production",
      });

      expect(options.enabled).toBe(false);
      expect(options.dsn).toBeUndefined();
    },
  );

  it("aucune option retirée du SDK v11 : pas de sendDefaultPii", () => {
    const options = activeOptions();

    expect(options).not.toHaveProperty("sendDefaultPii");
  });

  it("dataCollection coupe toute collecte de données personnelles", () => {
    const { dataCollection } = activeOptions();

    expect(dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: {
          allow: ["user-agent", "accept-language", "content-type", "host"],
        },
        response: false,
      },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
  });

  it("aucun traçage : ni tracesSampleRate, ni propagation sentry-trace / baggage", () => {
    const options = activeOptions();

    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("tracesSampler");
    expect(options).not.toHaveProperty("beforeSendTransaction");
    expect(options.tracePropagationTargets).toEqual([]);
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

  it("ne garde que les en-têtes de la liste blanche : referer, origin et inconnus retirés", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      message: "panne",
      request: {
        headers: {
          Referer: "https://app.example.test/x?email=a@b.test",
          Origin: "https://app.example.test",
          "x-nouveau": "secret",
          "User-Agent": "Safari",
          "Accept-Language": "fr-BE",
          "Content-Type": "text/plain",
          Host: "app.example.test",
        },
      },
    });

    expect(sent?.request?.headers).toEqual({
      "User-Agent": "Safari",
      "Accept-Language": "fr-BE",
      "Content-Type": "text/plain",
      Host: "app.example.test",
    });
  });

  it("beforeSend masque un e-mail et un JWT dans le message d'erreur", () => {
    const { beforeSend } = activeOptions();
    const jwt = "eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJhbnRvaW5lIn0.c2lnbmF0dXJl";

    const sent = beforeSend({
      type: undefined,
      message: `échec pour antoine@example.test avec ${jwt}`,
      logentry: {
        message:
          "connexion à postgresql://neondb_owner:mdp@ep-x.neon.tech/neondb",
        params: ["Bearer abc.def-123", 42],
      },
      exception: {
        values: [
          {
            type: "Error",
            value: `Authorization: Bearer ${jwt} pour Antoine.Monie+test@example.test`,
          },
          { type: "Error", value: "postgres://u:p@h/db refusé" },
        ],
      },
    });

    const serialized = JSON.stringify(sent);
    for (const leak of [
      "antoine@example.test",
      "Antoine.Monie+test@example.test",
      jwt,
      "eyJ",
      "mdp",
      "neondb_owner",
      "u:p@h",
      "abc.def-123",
    ]) {
      expect(serialized).not.toContain(leak);
    }
    expect(sent?.message).toBe("échec pour [email] avec [jwt]");
    expect(sent?.logentry?.params).toEqual(["Bearer [Filtered]", 42]);
  });

  it("extra est retiré", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      message: "panne",
      extra: { body: { email: "antoine@example.test" } },
    });

    expect(sent).not.toHaveProperty("extra");
  });

  it("seuls les contextes de la liste blanche restent, et trace perd ses données", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      message: "panne",
      contexts: {
        nextjs: { request_path: "/x" },
        runtime: { name: "node" },
        os: { name: "macOS" },
        browser: { name: "Safari" },
        device: { family: "Mac" },
        culture: { locale: "fr-BE" },
        trace: {
          trace_id: "t",
          span_id: "s",
          data: { "http.query": "email=antoine@example.test" },
        },
        state: {
          state: { type: "redux", value: { email: "antoine@example.test" } },
        },
        response: { status_code: 500 },
        inconnu: { secret: "x" },
      },
    });

    expect(sent?.contexts).toEqual({
      nextjs: { request_path: "/x" },
      runtime: { name: "node" },
      os: { name: "macOS" },
      browser: { name: "Safari" },
      device: { family: "Mac" },
      culture: { locale: "fr-BE" },
      trace: { trace_id: "t", span_id: "s" },
    });
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

  it("un fil HTTP serveur perd query et fragment de ses données", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "http",
      data: {
        url: "https://api.example.test/x",
        "url.query": "?email=antoine%40example.test",
        "url.fragment": "#jeton",
        "http.query": "email=antoine%40example.test",
        "http.fragment": "jeton",
        "http.method": "GET",
      },
    });

    expect(kept?.data).toEqual({
      url: "https://api.example.test/x",
      "http.method": "GET",
    });
  });

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
  it("renvoie l'origine https d'un DSN sentry.io, sans la clé", () => {
    expect(
      sentryDsnOrigin("https://clepublique@o1.ingest.de.sentry.io/42"),
    ).toBe("https://o1.ingest.de.sentry.io");
  });

  it.each([
    undefined,
    "",
    "pas une url",
    "http://cle@o1.ingest.sentry.io/42",
    "javascript:alert(1)",
    "https://cle@o1.ingest.example.test/42",
    "https://cle@sentry.io.example.test/42",
    "https://cle@evilsentry.io/42",
    "https://cle@evil.example;x.sentry.io/42",
    "https://cle@*.sentry.io/42",
  ])(
    "rien pour une valeur absente, invalide, non https ou hors sentry.io (%s)",
    (dsn) => {
      expect(sentryDsnOrigin(dsn)).toBeUndefined();
    },
  );
});
