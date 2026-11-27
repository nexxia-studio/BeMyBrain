// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { run } from "./vercel-production-deploy.mjs";

// Valeurs fictives : aucun projet, équipe, jeton ni dépôt réel.
const PROJECT = "prj_fake";
const TEAM = "team_fake";
const TOKEN = "tok_secret_fake";
const GH_TOKEN = "ghs_secret_fake";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98";
const DEPLOYMENT_ID = "dpl_fake";
const URL_HOST = "projet-fake-abc.vercel.example";

type Call = { method: string; url: URL; headers: Headers; body?: unknown };
type Reply = {
  status?: number;
  body: unknown;
  raw?: string;
  fail?: boolean;
};
type Handler = Reply | (() => Reply);

/** Faux fetch : API Vercel et API GitHub, une route par « méthode + chemin ». */
function fakeNetwork(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({
      method,
      url,
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const handler = routes[`${method} ${url.host}${url.pathname}`];
    if (!handler)
      return Response.json({ error: { code: "inconnu" } }, { status: 404 });
    const reply = typeof handler === "function" ? handler() : handler;
    if (reply.fail) throw new Error("réseau secret.example");
    if (reply.raw !== undefined)
      return new Response(reply.raw, { status: reply.status ?? 200 });
    return Response.json(reply.body, { status: reply.status ?? 200 });
  });
  return { fetch, calls };
}

const ready = {
  readyState: "READY",
  target: "production",
  aliasAssigned: true,
  alias: [URL_HOST],
  url: URL_HOST,
};

function baseRoutes(
  overrides: Record<string, Handler> = {},
): Record<string, Handler> {
  return {
    "GET api.github.com/repos/org/repo/git/ref/heads/main": {
      body: { object: { sha: SHA } },
    },
    [`GET api.vercel.com/v9/projects/${PROJECT}`]: {
      body: { name: "projet-fake" },
    },
    "POST api.vercel.com/v13/deployments": {
      body: { id: DEPLOYMENT_ID, target: "production" },
    },
    [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: { body: ready },
    [`PATCH api.vercel.com/v12/deployments/${DEPLOYMENT_ID}/cancel`]: {
      body: {},
    },
    ...overrides,
  };
}

function setup(
  routes: Record<string, Handler>,
  envOverrides: Record<string, string> = {},
) {
  const net = fakeNetwork(routes);
  const dir = mkdtempSync(join(tmpdir(), "deploy-"));
  const summaryFile = join(dir, "summary.md");
  writeFileSync(summaryFile, "");
  const logs: string[] = [];
  let clock = 0;
  const env = {
    VERCEL_TOKEN: TOKEN,
    VERCEL_PROJECT_ID: PROJECT,
    VERCEL_TEAM_ID: TEAM,
    SHA,
    GITHUB_REPOSITORY: "org/repo",
    GITHUB_REPOSITORY_ID: "42",
    GH_TOKEN,
    DEFAULT_GIT_BRANCH: "main",
    GITHUB_STEP_SUMMARY: summaryFile,
    ...envOverrides,
  };
  const sleep = vi.fn(async () => {
    clock += 10_000;
  });
  const io = {
    fetch: net.fetch,
    log: (l: string) => {
      logs.push(l);
    },
    sleep,
    now: () => clock,
  };
  return {
    ...net,
    env,
    io,
    logs,
    sleep,
    summary: () => readFileSync(summaryFile, "utf8"),
  };
}

const vercelCalls = (calls: Call[]) =>
  calls.filter((c) => c.url.host === "api.vercel.com");

describe("déploiement de production", () => {
  it("envoie target production, le SHA, le dépôt et forceNew=1, avec le nom du projet", async () => {
    const t = setup(baseRoutes());

    await run(t.env, t.io);

    const post = t.calls.find((c) => c.method === "POST");
    expect(post?.url.pathname).toBe("/v13/deployments");
    expect(post?.url.searchParams.get("forceNew")).toBe("1");
    expect(post?.url.searchParams.get("teamId")).toBe(TEAM);
    expect(post?.body).toEqual({
      name: "projet-fake",
      project: PROJECT,
      target: "production",
      gitSource: { type: "github", repoId: "42", ref: "main", sha: SHA },
    });
  });

  it("refuse un SHA qui n'a pas 40 caractères hexadécimaux", async () => {
    const t = setup(baseRoutes(), { SHA: "abc123" });

    await expect(run(t.env, t.io)).rejects.toThrow(/SHA/);

    expect(t.calls).toHaveLength(0);
  });

  it("ne crée aucun déploiement quand main est passée à un autre SHA", async () => {
    const t = setup(
      baseRoutes({
        "GET api.github.com/repos/org/repo/git/ref/heads/main": {
          body: { object: { sha: OTHER_SHA } },
        },
      }),
    );

    await run(t.env, t.io);

    expect(t.calls.some((c) => c.method === "POST")).toBe(false);
    expect(t.summary()).toContain(`remplacé par \`${OTHER_SHA.slice(0, 7)}\``);
  });

  it("lit la tête de main avec GH_TOKEN, sans le jeton Vercel", async () => {
    const t = setup(baseRoutes());

    await run(t.env, t.io);

    const github = t.calls.find((c) => c.url.host === "api.github.com");
    expect(github?.headers.get("authorization")).toBe(`Bearer ${GH_TOKEN}`);
    expect(JSON.stringify([...(github?.headers ?? [])])).not.toContain(TOKEN);
  });

  it("attend READY avec alias assigné puis écrit SHA court, état et durée, sans URL", async () => {
    let polls = 0;
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: () =>
          ++polls < 3
            ? { body: { readyState: "BUILDING", target: "production" } }
            : { body: ready },
      }),
    );

    await run(t.env, t.io);

    const summary = t.summary();
    expect(polls).toBe(3);
    expect(summary).toContain(SHA.slice(0, 7));
    expect(summary).toContain("READY");
    expect(summary).toMatch(/\d+ s/);
    expect(summary).not.toMatch(/https?:|vercel\.|\.app/i);
    expect(summary).not.toContain(URL_HOST);
  });

  it.each([
    ["ERROR", { readyState: "ERROR", target: "production" }],
    ["CANCELED", { readyState: "CANCELED", target: "production" }],
    [
      "aliasError",
      { ...ready, aliasError: { message: "alias secret.example" } },
    ],
  ])("échoue sur %s", async (_name, body) => {
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: { body },
      }),
    );

    await expect(run(t.env, t.io)).rejects.toThrow(/Déploiement Vercel/);
  });

  it("annule le déploiement puis échoue quand la cible n'est pas production", async () => {
    const t = setup(
      baseRoutes({
        "POST api.vercel.com/v13/deployments": {
          body: { id: DEPLOYMENT_ID, target: "preview" },
        },
      }),
    );

    await expect(run(t.env, t.io)).rejects.toThrow(/annulé/);

    expect(
      t.calls.some(
        (c) => c.method === "PATCH" && c.url.pathname.endsWith("/cancel"),
      ),
    ).toBe(true);
  });

  it("annule le déploiement puis échoue au délai dépassé (12 min en temps réel)", async () => {
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: {
          body: { readyState: "BUILDING", target: "production" },
        },
      }),
    );

    await expect(run(t.env, t.io)).rejects.toThrow(/trop long/);

    const cancels = t.calls.filter((c) => c.method === "PATCH");
    expect(cancels).toHaveLength(1);
    expect(t.sleep.mock.calls.length * 10_000).toBe(12 * 60_000);
  });

  it("n'écrit nulle part jeton, identifiant, URL ni corps de réponse", async () => {
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: {
          body: {
            readyState: "ERROR",
            target: "production",
            errorMessage: "corps secret.example",
          },
        },
      }),
    );

    const error = await run(t.env, t.io).catch((e: Error) => e);

    const written = [
      ...t.logs.filter((l) => !l.startsWith("::add-mask::")),
      t.summary(),
      String(error),
    ].join("\n");
    for (const secret of [
      TOKEN,
      GH_TOKEN,
      PROJECT,
      TEAM,
      DEPLOYMENT_ID,
      URL_HOST,
      "secret.example",
    ]) {
      expect(written).not.toContain(secret);
    }
    expect(written).not.toMatch(/https?:/);
  });

  it("masque projet et équipe avant tout appel", async () => {
    const t = setup(baseRoutes());
    const order: string[] = [];
    const log = t.io.log;
    t.io.log = (l) => {
      order.push(`log:${l}`);
      log(l);
    };
    t.fetch.mockImplementationOnce(async () => {
      order.push("fetch");
      return Response.json({ object: { sha: SHA } });
    });

    await run(t.env, t.io);

    const firstFetch = order.indexOf("fetch");
    expect(order.indexOf(`log:::add-mask::${PROJECT}`)).toBeLessThan(
      firstFetch,
    );
    expect(order.indexOf(`log:::add-mask::${TEAM}`)).toBeLessThan(firstFetch);
  });

  it.each([429, 503])(
    "réessaie un %i sans créer deux déploiements du même appel réussi",
    async (status) => {
      let attempts = 0;
      const t = setup(
        baseRoutes({
          "POST api.vercel.com/v13/deployments": () =>
            ++attempts === 1
              ? { status, body: {} }
              : { body: { id: DEPLOYMENT_ID, target: "production" } },
        }),
      );

      await run(t.env, t.io);

      expect(attempts).toBe(2);
      expect(
        vercelCalls(t.calls).filter((c) => c.method === "POST"),
      ).toHaveLength(2);
    },
  );

  it("n'écrit pas le message d'alias de Vercel, ni au journal, ni au résumé, ni dans l'erreur", async () => {
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: {
          body: { ...ready, aliasError: { message: "alias secret.example" } },
        },
      }),
    );

    const error = await run(t.env, t.io).catch((e: Error) => e);

    const written = [...t.logs, t.summary(), String(error)].join("\n");
    expect(String(error)).toMatch(/alias/);
    expect(t.calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
    expect(written).not.toContain("secret.example");
  });

  it("n'écrit pas un corps GitHub non JSON dans l'erreur", async () => {
    const t = setup(
      baseRoutes({
        "GET api.github.com/repos/org/repo/git/ref/heads/main": {
          body: null,
          raw: "<html>corps secret.example",
        },
      }),
    );

    const error = await run(t.env, t.io).catch((e: Error) => e);

    expect(String(error)).toContain("illisible");
    expect(String(error)).not.toContain("secret.example");
    expect(t.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it.each([
    ["le nom du projet", "GET api.vercel.com/v9/projects/prj_fake"],
    ["la création", "POST api.vercel.com/v13/deployments"],
    ["le sondage", `GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`],
  ])(
    "n'écrit pas un corps Vercel non JSON dans l'erreur (%s)",
    async (_name, route) => {
      const t = setup(
        baseRoutes({
          [route]: { body: null, raw: "<html>corps secret.example" },
        }),
      );

      const error = await run(t.env, t.io).catch((e: Error) => e);

      expect(String(error)).toContain("illisible");
      expect(String(error)).not.toContain("secret.example");
    },
  );

  it("échoue sans identifiant de déploiement et n'attend rien", async () => {
    const t = setup(
      baseRoutes({
        "POST api.vercel.com/v13/deployments": {
          body: { target: "production" },
        },
      }),
    );

    await expect(run(t.env, t.io)).rejects.toThrow(/sans identifiant/);

    expect(t.sleep).not.toHaveBeenCalled();
    expect(
      t.calls.filter(
        (c) => c.method === "GET" && c.url.pathname.includes("/v13/"),
      ),
    ).toHaveLength(0);
  });

  it("annule le déploiement quand l'attente échoue en HTTP, sans citer de corps", async () => {
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: {
          status: 500,
          body: { error: { message: "corps secret.example" } },
        },
      }),
    );

    const error = await run(t.env, t.io).catch((e: Error) => e);

    expect(String(error)).toContain("annulé");
    expect(String(error)).not.toContain("secret.example");
    expect(t.calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
  });

  it("annule le déploiement quand l'état renvoyé est null", async () => {
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: { body: null },
      }),
    );

    const error = await run(t.env, t.io).catch((e: Error) => e);

    expect(String(error)).toContain("annulé");
    expect(String(error)).not.toMatch(/null|reading/);
    expect(t.calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
  });

  it("n'annule pas un déploiement en échec définitif (ERROR)", async () => {
    const t = setup(
      baseRoutes({
        [`GET api.vercel.com/v13/deployments/${DEPLOYMENT_ID}`]: {
          body: { readyState: "ERROR", target: "production" },
        },
      }),
    );

    await expect(run(t.env, t.io)).rejects.toThrow(/en échec \(ERROR\)/);

    expect(t.calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("n'annule pas un déploiement prêt quand le résumé ne s'écrit pas, et échoue", async () => {
    const t = setup(baseRoutes(), {
      GITHUB_STEP_SUMMARY: "/dossier/absent/summary.md",
    });

    await expect(run(t.env, t.io)).rejects.toThrow(/résumé du job non écrit/);

    expect(t.calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("ne réessaie jamais la création après une absence de réponse : un seul POST", async () => {
    const t = setup(
      baseRoutes({
        "POST api.vercel.com/v13/deployments": { body: null, fail: true },
      }),
    );

    const error = await run(t.env, t.io).catch((e: Error) => e);

    expect(t.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(String(error)).toContain("à vérifier dans Vercel");
    expect(String(error)).not.toContain("secret.example");
  });

  it("ne cite pas une cible ou un état de Vercel qui n'a pas la forme d'un identifiant", async () => {
    const t = setup(
      baseRoutes({
        "POST api.vercel.com/v13/deployments": {
          body: { id: DEPLOYMENT_ID, target: "https://secret.example/x" },
        },
      }),
    );

    const error = await run(t.env, t.io).catch((e: Error) => e);

    expect(String(error)).toContain("annulé");
    expect(String(error)).not.toContain("secret.example");
  });

  it.each([
    ["GITHUB_REPOSITORY", "org/repo/../x"],
    ["GITHUB_REPOSITORY", "pas-un-depot"],
    ["GITHUB_REPOSITORY_ID", "42; rm"],
    ["DEFAULT_GIT_BRANCH", "ma\nbranche"],
    ["DEFAULT_GIT_BRANCH", "x".repeat(251)],
  ])("refuse %s = %j avant tout appel", async (name, value) => {
    const t = setup(baseRoutes(), { [name]: value });

    await expect(run(t.env, t.io)).rejects.toThrow(/refusée/);

    expect(t.calls).toHaveLength(0);
    expect(t.logs).toHaveLength(0);
  });

  it("distingue une tête de main illisible d'un remplacement", async () => {
    const t = setup(
      baseRoutes({
        "GET api.github.com/repos/org/repo/git/ref/heads/main": {
          body: { object: { sha: "pas-un-sha" } },
        },
      }),
    );

    await expect(run(t.env, t.io)).rejects.toThrow(/illisible/);

    expect(t.summary()).toContain("illisible");
    expect(t.summary()).not.toContain("remplacé par");
    expect(t.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("refuse un identifiant de déploiement mal formé, sans le masquer ni l'utiliser", async () => {
    const t = setup(
      baseRoutes({
        "POST api.vercel.com/v13/deployments": {
          body: { id: "dpl_x\n::set-env::A", target: "production" },
        },
      }),
    );

    await expect(run(t.env, t.io)).rejects.toThrow(/sans identifiant/);

    expect(t.logs.join("\n")).not.toContain("set-env");
    expect(
      t.calls.filter(
        (c) =>
          c.url.pathname.includes("/v13/deployments/") || c.method === "PATCH",
      ),
    ).toHaveLength(0);
  });
});
