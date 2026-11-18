// @vitest-environment node
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { scrubEvent, sentryDsnOrigin, sentryOptions } from "./sentry-options";

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
      url: "https://api.example.test",
      "http.method": "GET",
    });
  });

  // Indice passé par le SDK navigateur avec un fil de clic : l'événement DOM, dont la cible est l'élément.
  function clickHint(target: unknown) {
    return { event: { target } };
  }

  it("un clic ne garde que la balise de l'élément cliqué, lue sur l'élément, sans libellé ni parent", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb(
      {
        category: "ui.click",
        message:
          'main#tache-rdv.liste > li.min-h-11[title="RDV médecin"] > button#supprimer-rdv.min-h-11[aria-label="Supprimer la tâche RDV médecin"][type="submit"][name="rdv"][title="RDV médecin"]',
        data: { "ui.component_name": "TaskCard" },
      },
      clickHint({ tagName: "BUTTON" }),
    );

    expect(kept).toEqual({ category: "ui.click", message: "button" });
  });

  it("un libellé à guillemets impairs ne fait jamais passer un de ses mots pour une balise", () => {
    const { beforeBreadcrumb } = activeOptions();
    const message = 'button[aria-label="Supprimer 13" > rdv.medecin"]';

    const withElement = beforeBreadcrumb(
      { category: "ui.click", message },
      clickHint({ tagName: "BUTTON" }),
    );
    const withoutHint = beforeBreadcrumb({ category: "ui.click", message });

    expect(withElement).toEqual({ category: "ui.click", message: "button" });
    expect(withoutHint).toEqual({ category: "ui.click" });
  });

  it.each([
    ["sans indice", undefined],
    ["sans événement", {}],
    ["cible absente", { event: {} }],
    ["cible sans tagName", clickHint({ nodeName: "BUTTON" })],
    ["tagName non textuel", clickHint({ tagName: 42 })],
    ["tagName hors balise", clickHint({ tagName: "RDV médecin" })],
  ])("un clic sans balise sûre (%s) part sans message ni donnée", (_, hint) => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb(
      {
        category: "ui.click",
        message: "div.a > TaskCard",
        data: { "ui.component_name": "TaskCard" },
      },
      hint,
    );

    expect(kept).toEqual({ category: "ui.click" });
  });
});

describe("URL des fils d'Ariane", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function scrubbedUrls(data: Record<string, unknown>) {
    return activeOptions().beforeBreadcrumb({ category: "fetch", data })?.data;
  }

  it("une URL d'un autre site est réduite à son origine", () => {
    vi.stubGlobal("location", { origin: "https://app.example.test" });

    expect(
      scrubbedUrls({
        url: "https://api.autre.test:8443/v1/taches/rdv-medecin?jeton=x#y",
        from: "//cdn.autre.test/a/b?c=d",
        to: "https://app.example.test.autre.test/x",
      }),
    ).toEqual({
      url: "https://api.autre.test:8443",
      from: "https://cdn.autre.test",
      to: "https://app.example.test.autre.test",
    });
  });

  it("une URL absolue de la même origine que la page est réduite à son chemin", () => {
    vi.stubGlobal("location", { origin: "https://app.example.test" });

    expect(
      scrubbedUrls({
        url: "https://app.example.test/api/x?email=antoine%40example.test#f",
      }),
    ).toEqual({ url: "/api/x" });
  });

  it("côté serveur (sans location), toute URL absolue est réduite à son origine", () => {
    expect(scrubbedUrls({ url: "https://app.example.test/api/x?q=1" })).toEqual(
      { url: "https://app.example.test" },
    );
  });

  it("une URL relative garde son chemin, sans query ni fragment", () => {
    expect(scrubbedUrls({ url: "/api/x?q=1#f", to: "taches/1#f" })).toEqual({
      url: "/api/x",
      to: "taches/1",
    });
  });

  it.each([
    ["https://rdv médecin.test/x", "absolue non analysable"],
    ["data:text/plain,RDV médecin", "sans origine"],
    ["ftp://fichiers.autre.test/rdv", "schéma ftp"],
    ["//[RDV médecin", "sans protocole non analysable"],
  ])("une URL %s (%s) est retirée", (url) => {
    expect(scrubbedUrls({ url, method: "GET" })).toEqual({ method: "GET" });
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

describe("URL des fils d'Ariane, schémas et hôtes d'infrastructure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("une URL blob: de la même origine que la page est retirée", () => {
    vi.stubGlobal("location", { origin: "https://app.example.test" });

    const kept = activeOptions().beforeBreadcrumb({
      category: "fetch",
      data: {
        url: "blob:https://app.example.test/3f6c1d2e-rdv",
        method: "GET",
      },
    });

    expect(kept?.data).toEqual({ method: "GET" });
  });

  it.each([
    "https://ep-rdv-medecin-123456.eu-central-1.aws.neon.tech/sql?q=1",
    "https://ep-x.c-2.eu-central-1.aws.neon.tech:443/",
    "https://neon.tech/api",
  ])("une URL Neon (%s) part sans l'hôte de la branche", (url) => {
    const kept = activeOptions().beforeBreadcrumb({
      category: "http",
      data: { url },
    });

    expect(kept?.data).toEqual({ url: "https://[neon]" });
  });

  it("un hôte qui ne fait que contenir neon.tech n'est pas confondu avec Neon", () => {
    const kept = activeOptions().beforeBreadcrumb({
      category: "http",
      data: { url: "https://pasneon.tech/x" },
    });

    expect(kept?.data).toEqual({ url: "https://pasneon.tech" });
  });
});

describe("nettoyage complémentaire (audit de sécurité)", () => {
  const NEON_HOST = "ep-rdv-123456.eu-central-1.aws.neon.tech";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("un hôte Neon est masqué dans la valeur d'une exception", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      exception: {
        values: [
          { type: "Error", value: `getaddrinfo ENOTFOUND ${NEON_HOST}` },
        ],
      },
    });

    expect(sent?.exception?.values?.[0]?.value).toBe(
      "getaddrinfo ENOTFOUND [neon]",
    );
  });

  it("une URL Postgres vers Neon reste masquée en entier, sans fuite du mot de passe", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      message: `postgresql://neondb_owner:mdp@${NEON_HOST}/neondb refusé`,
    });

    expect(sent?.message).toBe("[postgres-url] refusé");
  });

  it("un e-mail sur un domaine Neon reste masqué en entier", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      message: `écrire à antoine@${NEON_HOST}`,
    });

    expect(sent?.message).toBe("écrire à [email]");
  });

  it.each([
    [
      "child_process",
      "Child process errored with 'connect ECONNREFUSED antoine@example.test'",
      "Child process errored with 'connect ECONNREFUSED [email]'",
    ],
    ["manuel", "appel avec Bearer abc.def-123", "appel avec Bearer [Filtered]"],
    [
      "http",
      `getaddrinfo ENOTFOUND ${NEON_HOST}`,
      "getaddrinfo ENOTFOUND [neon]",
    ],
  ])("le message d'un fil %s est masqué", (category, message, expected) => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({ category, message });

    expect(kept).toEqual({ category, message: expected });
  });

  it("une valeur url, from ou to qui n'est pas une chaîne est retirée", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: {
        url: {
          href: "https://app.example.test/x?email=antoine%40example.test",
        },
        from: ["/reset-password?email=antoine%40example.test"],
        to: 42,
        method: "GET",
      },
    });

    expect(kept?.data).toEqual({ method: "GET" });
  });

  it("le chemin d'une URL relative est masqué", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: { url: "/x/antoine@example.com?q=1" },
    });

    expect(kept?.data).toEqual({ url: "/x/[email]" });
  });

  it("beforeSend repasse les fils d'Ariane de l'événement au nettoyage", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      breadcrumbs: [
        {
          category: "ui.click",
          message: 'button[aria-label="RDV médecin"]',
          data: { "ui.component_name": "TaskCard" },
        },
        { category: "console", message: "antoine@example.test" },
        {
          category: "fetch",
          message: "Bearer abc.def-123",
          data: {
            url: "https://api.autre.test/x?email=antoine%40example.test",
          },
        },
      ],
    });

    expect(sent?.breadcrumbs).toEqual([
      { category: "ui.click" },
      { category: "console" },
      {
        category: "fetch",
        message: "Bearer [Filtered]",
        data: { url: "https://api.autre.test" },
      },
    ]);
  });

  it("un fil déjà nettoyé ne change plus au second passage", () => {
    vi.stubGlobal("location", { origin: "https://app.example.test" });
    const { beforeBreadcrumb } = activeOptions();
    const once = [
      beforeBreadcrumb(
        { category: "ui.click", message: "div > button#x" },
        { event: { target: { tagName: "BUTTON" } } },
      ),
      beforeBreadcrumb({
        category: "http",
        data: { url: `https://${NEON_HOST}/sql` },
      }),
      beforeBreadcrumb({
        category: "fetch",
        data: { url: "https://api.autre.test/x" },
      }),
      beforeBreadcrumb({ category: "fetch", data: { url: "/api/x?q=1" } }),
      beforeBreadcrumb({
        category: "fetch",
        data: { url: "https://app.example.test/x/antoine@example.com?q=1" },
      }),
      beforeBreadcrumb({ category: "fetch", data: { url: "/u/a%40b.fr" } }),
    ];

    const twice = scrubEvent({
      type: undefined,
      breadcrumbs: once,
    }).breadcrumbs;

    expect(twice).toEqual(once);
    expect(once[0]).toEqual({ category: "ui.click", message: "button" });
    expect(once[1]?.data).toEqual({ url: "https://[neon]" });
    expect(once[4]?.data).toEqual({ url: "/x/[email]" });
    expect(once[5]?.data).toEqual({ url: "/u/[email]" });
  });
});

describe("relecture de 2371036", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["dupont", "rdv-cardiologue-lundi"])(
    "un clic sans indice dont le message (%s) n'est pas une balise HTML standard part sans message",
    (message) => {
      const { beforeBreadcrumb, beforeSend } = activeOptions();

      const first = beforeBreadcrumb({ category: "ui.click", message });
      const viaEvent = beforeSend({
        type: undefined,
        breadcrumbs: [{ category: "ui.click", message }],
      });

      expect(first).toEqual({ category: "ui.click" });
      expect(viaEvent?.breadcrumbs).toEqual([{ category: "ui.click" }]);
    },
  );

  it("un clic avec un indice à cible illisible part sans message, jamais avec le sien", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb(
      { category: "ui.click", message: "antoine" },
      { event: { target: {} } },
    );

    expect(kept).toEqual({ category: "ui.click" });
  });

  it("un clic indiqué par une balise HTML de la liste, sans indice, la garde", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({ category: "ui.click", message: "button" });

    expect(kept).toEqual({ category: "ui.click", message: "button" });
  });

  it("une URL de même origine perd son e-mail du chemin", () => {
    vi.stubGlobal("location", { origin: "https://app.example.test" });
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: { url: "https://app.example.test/x/antoine@example.com?q=1" },
    });

    expect(kept?.data).toEqual({ url: "/x/[email]" });
  });

  it("un e-mail encodé (%40) dans un chemin est masqué", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: { url: "/u/a%40b.fr" },
    });

    expect(kept?.data).toEqual({ url: "/u/[email]" });
  });

  it("un chemin au codage invalide est retiré", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: { url: "/u/%E0%A4%A", method: "GET" },
    });

    expect(kept?.data).toEqual({ method: "GET" });
  });

  it("un mot de passe en clair (password=, pwd=) est masqué dans un texte", () => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({
      type: undefined,
      message: "host=ep-x.neon.tech password=secret PWD=autre",
    });

    expect(sent?.message).toBe(
      "host=[neon] password=[Filtered] PWD=[Filtered]",
    );
  });

  it("les autres valeurs de data d'un fil sont masquées", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "http",
      data: {
        foo: "a@b.fr",
        objet: { email: "a@b.fr" },
        status_code: 500,
        ok: false,
        method: "GET",
      },
    });

    expect(kept?.data).toEqual({
      foo: "[email]",
      objet: "[Filtered]",
      status_code: 500,
      ok: false,
      method: "GET",
    });
  });
});

describe("relecture de 2cb0322", () => {
  function twicePassed(
    kept: ReturnType<ReturnType<typeof activeOptions>["beforeBreadcrumb"]>,
  ) {
    return scrubEvent({ type: undefined, breadcrumbs: kept ? [kept] : [] })
      .breadcrumbs?.[0];
  }

  it.each(["MARK", "X-FOO"])(
    "un clic sur une balise hors liste (%s) part sans message, au premier comme au second passage",
    (tagName) => {
      const { beforeBreadcrumb } = activeOptions();

      const kept = beforeBreadcrumb(
        { category: "ui.click", message: "div > mark" },
        { event: { target: { tagName } } },
      );

      expect(kept).toEqual({ category: "ui.click" });
      expect(twicePassed(kept)).toEqual({ category: "ui.click" });
    },
  );

  it("un e-mail encodé deux fois (%2540) dans un chemin est masqué", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: { url: "/u/a%2540b.fr" },
    });

    expect(kept?.data).toEqual({ url: "/u/[email]" });
  });

  it("un chemin encodé plus de trois fois est retiré", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: { url: "/u/a%25252540b.fr", method: "GET" },
    });

    expect(kept?.data).toEqual({ method: "GET" });
  });

  it.each([
    ["/u/100%25", undefined],
    ["/a%3Fb%23c", "/a%3Fb%23c"],
  ])("le chemin %s reste stable au second passage", (url, expected) => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({ category: "fetch", data: { url } });

    expect(kept?.data).toEqual(expected === undefined ? {} : { url: expected });
    expect(twicePassed(kept)).toEqual(kept);
  });

  it.each(["UI.click", "ui", "Console", "UI.Input"])(
    "un fil de catégorie %s ne garde ni message ni donnée",
    (category) => {
      const { beforeBreadcrumb } = activeOptions();

      const kept = beforeBreadcrumb({
        category,
        message: "Supprimer la tâche RDV médecin",
        data: { "ui.component_name": "TaskCard" },
      });

      expect(kept).toEqual({ category });
    },
  );

  it.each([
    ["password=secret1", "password=[Filtered]"],
    ["passwd=secret1", "passwd=[Filtered]"],
    ["PWD: secret1", "PWD: [Filtered]"],
    ["secret=secret1", "secret=[Filtered]"],
    ["token=secret1&x=1", "token=[Filtered]&x=1"],
    ["user_password=secret1", "user_password=[Filtered]"],
    ["access_token: secret1", "access_token: [Filtered]"],
    ['{"password":"secret1","x":1}', '{"password":"[Filtered]","x":1}'],
    ['{"api_secret": "secret1"}', '{"api_secret": "[Filtered]"}'],
  ])("le mot de passe de « %s » est masqué", (message, expected) => {
    const { beforeSend } = activeOptions();

    const sent = beforeSend({ type: undefined, message });

    expect(sent?.message).toBe(expected);
  });

  it.each(["mypassword=visible", "passwordless=visible", "tokens"])(
    "« %s » n'est pas pris pour un mot de passe",
    (message) => {
      const { beforeSend } = activeOptions();

      const sent = beforeSend({ type: undefined, message });

      expect(sent?.message).toBe(message);
    },
  );

  it("une valeur de data qui est une URL http(s) d'un autre site est réduite à son origine", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "http",
      data: {
        "http.url": "https://ex.com/a?token=abc",
        "url.full": "HTTP://ex.com/b#jeton",
      },
    });

    expect(kept?.data).toEqual({
      "http.url": "https://ex.com",
      "url.full": "http://ex.com",
    });
  });
});

describe("relecture de 04f39cb", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["password=ab,cd", "password=[Filtered]"],
    ["password=p&ss", "password=[Filtered]&ss"],
    ["password=p;ss suite", "password=[Filtered] suite"],
    ['{"password":"a b c"}', '{"password":"[Filtered]"}'],
    ['{"password": "a b"}', '{"password": "[Filtered]"}'],
    ["password='a b' suite", "password='[Filtered]' suite"],
    ["secret_key=abc", "secret_key=[Filtered]"],
    ['{"secret_key": "a, b"}', '{"secret_key": "[Filtered]"}'],
  ])(
    "la valeur entière du secret de « %s » est masquée",
    (message, expected) => {
      const { beforeSend } = activeOptions();

      const sent = beforeSend({ type: undefined, message });

      expect(sent?.message).toBe(expected);
    },
  );

  it.each([
    ["/u/%25zz/a%2540b.fr"],
    ["/u/a%2540b.fr%25zz"],
    ["https://app.example.test/u/a%25%2540b.fr"],
  ])("un chemin dont un décodage suivant échoue (%s) est retiré", (url) => {
    vi.stubGlobal("location", { origin: "https://app.example.test" });
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "fetch",
      data: { url, method: "GET" },
    });

    expect(kept?.data).toEqual({ method: "GET" });
  });

  it("les valeurs de data qui ressemblent à une URL sont nettoyées comme url", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "http",
      data: {
        "http.target": "/r?code=abc",
        "http.url": " https://ex.com/a?code=1",
        "url.full": "https://ex.com/u/a%40b.fr",
        "url.path": "/u/a%2540b.fr",
        "url.bad": "/u/%E0%A4%A",
        method: "GET",
      },
    });

    expect(kept?.data).toEqual({
      "http.target": "/r",
      "http.url": "https://ex.com",
      "url.full": "https://ex.com",
      "url.path": "/u/[email]",
      method: "GET",
    });
  });

  it("un texte très long est tronqué avant les masques, en moins d'une seconde et à 2 000 caractères au plus", () => {
    const { beforeSend } = activeOptions();
    const long = "a.".repeat(100_000);

    const start = performance.now();
    const sent = beforeSend({ type: undefined, message: long });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(sent?.message?.length).toBeLessThanOrEqual(2000);
  });

  it("la troncature ne laisse pas un e-mail coupé à la limite", () => {
    const { beforeSend } = activeOptions();
    const message = `${"x ".repeat(995)}antoine@example.test suite`;

    const sent = beforeSend({ type: undefined, message });

    expect(sent?.message).not.toContain("antoine");
    expect(sent?.message?.endsWith("…")).toBe(true);
  });
});

describe("relecture de c32d523", () => {
  it.each([
    [JSON.stringify({ password: 'pa"ss' }), '{"password":"[Filtered]"}'],
    ["password='a\\'b' suite", "password='[Filtered]' suite"],
    ['{"token": "a\\\\"} suite', '{"token": "[Filtered]"} suite'],
  ])(
    "un guillemet échappé dans la valeur du secret (%s) ne laisse rien fuir",
    (message, expected) => {
      const { beforeSend } = activeOptions();

      const sent = beforeSend({ type: undefined, message });

      expect(sent?.message).toBe(expected);
    },
  );

  it("une valeur de data qui commence par https:// mais contient un espace est masquée comme un texte", () => {
    const { beforeBreadcrumb } = activeOptions();

    const kept = beforeBreadcrumb({
      category: "http",
      data: { info: "https://ex.com is down a@b.fr" },
    });

    expect(kept?.data).toEqual({ info: "https://ex.com is down [email]" });
  });

  it("un texte tronqué reste identique au second passage", () => {
    const { beforeBreadcrumb } = activeOptions();
    const message = `${"ab ".repeat(666)}cd suite et fin`;

    const kept = beforeBreadcrumb({ category: "http", message });
    const twice = scrubEvent({
      type: undefined,
      breadcrumbs: kept ? [kept] : [],
    }).breadcrumbs?.[0];

    expect(message[2000]).toBe(" ");
    expect(kept?.message?.length).toBeLessThanOrEqual(2000);
    expect(twice).toEqual(kept);
  });
});

describe("relecture de efd693f", () => {
  function twicePassed(message: string) {
    const kept = activeOptions().beforeBreadcrumb({
      category: "http",
      message,
    });
    const twice = scrubEvent({
      type: undefined,
      breadcrumbs: kept ? [kept] : [],
    }).breadcrumbs?.[0];
    return { kept, twice };
  }

  it.each([
    ['password="ab\\\ncd hunter2" suite', 'password="[Filtered]" suite'],
    ["password='ab\\\ncd hunter2' suite", "password='[Filtered]' suite"],
  ])(
    "un retour à la ligne échappé dans la valeur du secret (%j) ne laisse rien fuir",
    (message, expected) => {
      const { beforeSend } = activeOptions();

      const sent = beforeSend({ type: undefined, message });

      expect(sent?.message).toBe(expected);
    },
  );

  it.each([
    ['{\\"password\\":\\"abc def\\"}', '{\\"password\\":\\"[Filtered]\\"}'],
    ['password=\\"abc def\\" suite', 'password=\\"[Filtered]\\" suite'],
    ["password=\\'abc def\\' suite", "password=\\'[Filtered]\\' suite"],
  ])(
    "un secret en JSON échappé deux fois (%s) est masqué en entier",
    (message, expected) => {
      const { beforeSend } = activeOptions();

      const sent = beforeSend({ type: undefined, message });

      expect(sent?.message).toBe(expected);
    },
  );

  it.each([
    ["e-mail", `${"x ".repeat(997)}a@b.fr`],
    ["secret et e-mail", `${"x ".repeat(990)}pwd=a a@b.fr`],
  ])(
    "un texte que les masques allongent au-delà de la limite (%s) reste borné et stable",
    (_, message) => {
      const { kept, twice } = twicePassed(message);

      expect(kept?.message?.length).toBeLessThanOrEqual(2000);
      expect(twice).toEqual(kept);
    },
  );
});
