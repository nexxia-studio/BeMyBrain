// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  PREVIEW_KEYS,
  deletePreviewEnv,
  deployBranch,
  readProjectName,
  run,
  syncPreviewEnv,
  waitForBranchOrigin,
} from "./vercel-preview-env.mjs";

// Valeurs fictives : aucun projet, équipe, hôte ni mot de passe réel.
const PROJECT = "prj_fake";
const TEAM = "team_fake";
const BRANCH = "feat/x";
const NEON_HOST = "ep-fake-1.neonauth.eu.aws.neon.example";
const VALUES = {
  DATABASE_AUTHENTICATED_URL: `postgresql://app_backend:npg_secret@ep-fake-1.eu.aws.neon.example/neondb`,
  NEON_AUTH_BASE_URL: `https://${NEON_HOST}/neondb/auth`,
  NEON_AUTH_JWKS_URL: `https://${NEON_HOST}/neondb/auth/.well-known/jwks.json`,
  NEON_AUTH_ISSUER: `https://${NEON_HOST}`,
  NEON_AUTH_AUDIENCE: `https://${NEON_HOST}`,
};
const BRANCH_ALIAS = "projet-git-feat-x-equipe.vercel.example";

type Route = { method: string; path: RegExp; status?: number; body: unknown };
type Call = {
  method: string;
  path: string;
  query: URLSearchParams;
  body?: unknown;
};

/** Faux client de l'API REST Vercel : chaque appel doit correspondre à une route (sinon 404). */
function fakeVercelApi(routes: Route[]) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({
      method,
      path: url.pathname,
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const route = routes.find(
      (r) => r.method === method && r.path.test(url.pathname),
    );
    if (!route)
      return Response.json({ error: { message: "inconnu" } }, { status: 404 });
    return Response.json(route.body, { status: route.status ?? 200 });
  });
  return {
    fetch,
    calls,
    api: {
      token: "t",
      projectId: PROJECT,
      teamId: TEAM,
      fetch,
      sleep: async () => {},
    },
  };
}

const envList = (envs: object[]): Route => ({
  method: "GET",
  path: new RegExp(`^/v10/projects/${PROJECT}/env$`),
  body: { envs, pagination: { count: envs.length, next: null, prev: null } },
});
const createEnv: Route = {
  method: "POST",
  path: new RegExp(`^/v10/projects/${PROJECT}/env$`),
  status: 201,
  body: { created: [], failed: [] },
};
const editEnv: Route = {
  method: "PATCH",
  path: new RegExp(`^/v9/projects/${PROJECT}/env/[\\w-]+$`),
  body: {},
};
const removeEnv: Route = {
  method: "DELETE",
  path: new RegExp(`^/v9/projects/${PROJECT}/env/[\\w-]+$`),
  body: {},
};
const branchVar = (key: string, gitBranch = BRANCH) => ({
  id: gitBranch === BRANCH ? `env-${key}` : `env-${key}-autre`,
  key,
  target: ["preview"],
  gitBranch,
  type: "encrypted",
  value: "chiffré",
});

describe("variables de la preview", () => {
  it("crée les cinq variables chiffrées, preview seulement, limitées à la branche git", async () => {
    const { api, calls } = fakeVercelApi([envList([]), createEnv]);

    await syncPreviewEnv(api, BRANCH, VALUES);

    const created = calls.filter((c) => c.method === "POST");
    expect(created).toHaveLength(1);
    expect(created[0].path).toBe(`/v10/projects/${PROJECT}/env`);
    expect(created[0].query.get("teamId")).toBe(TEAM);
    expect(created[0].body).toEqual(
      PREVIEW_KEYS.map((key) => ({
        key,
        value: VALUES[key as keyof typeof VALUES],
        type: "encrypted",
        target: ["preview"],
        gitBranch: BRANCH,
      })),
    );
  });

  it("lit les variables existantes filtrées sur la branche git, avec teamId", async () => {
    const { api, calls } = fakeVercelApi([envList([]), createEnv]);

    await syncPreviewEnv(api, BRANCH, VALUES);

    expect(calls[0].method).toBe("GET");
    expect(calls[0].query.get("gitBranch")).toBe(BRANCH);
    expect(calls[0].query.get("teamId")).toBe(TEAM);
    expect(calls[0].query.get("decrypt")).toBeNull();
  });

  it("met à jour en place les variables déjà posées sur la branche (idempotent)", async () => {
    const { api, calls } = fakeVercelApi([
      envList(PREVIEW_KEYS.map((key) => branchVar(key))),
      createEnv,
      editEnv,
    ]);

    const result = await syncPreviewEnv(api, BRANCH, VALUES);

    expect(calls.some((c) => c.method === "POST")).toBe(false);
    const edits = calls.filter((c) => c.method === "PATCH");
    expect(edits.map((c) => c.path)).toEqual(
      PREVIEW_KEYS.map((key) => `/v9/projects/${PROJECT}/env/env-${key}`),
    );
    expect(edits[0].body).toEqual({
      value: VALUES.DATABASE_AUTHENTICATED_URL,
      type: "encrypted",
      target: ["preview"],
      gitBranch: BRANCH,
    });
    expect(result).toEqual({ created: 0, updated: 5 });
  });

  it("ne touche ni aux variables de toutes les previews ni à celles d'une autre branche", async () => {
    const { api, calls } = fakeVercelApi([
      envList([
        {
          id: "env-cookie",
          key: "NEON_AUTH_COOKIE_SECRET",
          target: ["preview"],
        },
        { id: "env-all", key: "NEON_AUTH_BASE_URL", target: ["preview"] },
        branchVar("NEON_AUTH_BASE_URL", "autre"),
      ]),
      createEnv,
      editEnv,
    ]);

    await syncPreviewEnv(api, BRANCH, VALUES);

    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    expect(
      (calls.find((c) => c.method === "POST")?.body as object[]).length,
    ).toBe(5);
  });

  it("n'envoie jamais DATABASE_URL à Vercel", async () => {
    const { api, calls } = fakeVercelApi([envList([]), createEnv]);

    await syncPreviewEnv(api, BRANCH, {
      ...VALUES,
      DATABASE_URL: "postgresql://neondb_owner:proprio@hote/neondb",
    });

    expect(JSON.stringify(calls.map((c) => c.body))).not.toContain("proprio");
    expect(PREVIEW_KEYS).not.toContain("DATABASE_URL");
  });

  it("refuse de poser une variable manquante, sans appel à l'API", async () => {
    const { api, calls } = fakeVercelApi([envList([]), createEnv]);
    const incomplete = { ...VALUES, NEON_AUTH_ISSUER: undefined };

    await expect(syncPreviewEnv(api, BRANCH, incomplete)).rejects.toThrow(
      /NEON_AUTH_ISSUER manquante/,
    );
    expect(calls).toHaveLength(0);
  });

  it.each(["", "a\nb", "x".repeat(251)])(
    "refuse le nom de branche git %j",
    async (gitBranch) => {
      const { api, calls } = fakeVercelApi([envList([]), createEnv]);

      await expect(syncPreviewEnv(api, gitBranch, VALUES)).rejects.toThrow(
        /Branche git refusée/,
      );
      expect(calls).toHaveLength(0);
    },
  );
});

describe("suppression des variables à la fermeture de la PR", () => {
  it("supprime les cinq variables de la branche et rien d'autre", async () => {
    const { api, calls } = fakeVercelApi([
      envList([
        ...PREVIEW_KEYS.map((key) => branchVar(key)),
        {
          id: "env-cookie",
          key: "NEON_AUTH_COOKIE_SECRET",
          target: ["preview"],
        },
        branchVar("NEON_AUTH_BASE_URL", "autre"),
        branchVar("AUTRE_VARIABLE"),
      ]),
      removeEnv,
    ]);

    const removed = await deletePreviewEnv(api, BRANCH);

    expect(removed).toBe(5);
    expect(
      calls.filter((c) => c.method === "DELETE").map((c) => c.path),
    ).toEqual(
      PREVIEW_KEYS.map((key) => `/v9/projects/${PROJECT}/env/env-${key}`),
    );
    expect(calls.every((c) => c.query.get("teamId") === TEAM)).toBe(true);
  });

  it("ne fait rien si les variables sont déjà supprimées", async () => {
    const { api, calls } = fakeVercelApi([envList([]), removeEnv]);

    const removed = await deletePreviewEnv(api, BRANCH);

    expect(removed).toBe(0);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});

const PROJECT_NAME = "projet";
const projectRoute: Route = {
  method: "GET",
  path: new RegExp(`^/v9/projects/${PROJECT}$`),
  body: { id: PROJECT, name: PROJECT_NAME },
};
const SOURCE = {
  gitBranch: BRANCH,
  sha: "abc123",
  repoId: "42",
  projectName: PROJECT_NAME,
};
// `name` du déploiement renvoyé : jamais utilisé pour trouver l'alias (le nom du projet est lu à part).
const createDeployment: Route = {
  method: "POST",
  path: /^\/v13\/deployments$/,
  body: {
    id: "dpl_new",
    name: "autre",
    readyState: "QUEUED",
    alias: [],
    target: null,
  },
};
const deploymentState = (body: object): Route => ({
  method: "GET",
  path: /^\/v13\/deployments\/dpl_new$/,
  body: { id: "dpl_new", name: "autre", ...body },
});
const READY = {
  readyState: "READY",
  aliasAssigned: true,
  alias: ["projet-antoine-equipe.vercel.example", BRANCH_ALIAS],
};

describe("redéploiement de la branche", () => {
  it("crée un déploiement preview depuis le commit de la PR, sans déduplication", async () => {
    const { api, calls } = fakeVercelApi([createDeployment]);

    const deployment = await deployBranch(api, SOURCE);

    expect(deployment).toEqual({ id: "dpl_new" });
    expect(calls[0].path).toBe("/v13/deployments");
    expect(calls[0].query.get("forceNew")).toBe("1");
    expect(calls[0].query.get("teamId")).toBe(TEAM);
    expect(calls[0].body).toEqual({
      name: PROJECT_NAME,
      project: PROJECT,
      gitSource: { type: "github", repoId: "42", ref: BRANCH, sha: "abc123" },
    });
  });

  it("n'envoie aucune cible : Vercel n'admet pas « preview », l'absence de cible vaut preview", async () => {
    const { api, calls } = fakeVercelApi([createDeployment]);

    await deployBranch(api, SOURCE);

    expect(calls[0].body).not.toHaveProperty("target");
  });

  it("nomme le déploiement par le nom du projet, jamais par son identifiant", async () => {
    const { api, calls } = fakeVercelApi([createDeployment]);

    await deployBranch(api, SOURCE);

    expect((calls[0].body as { name: string }).name).toBe(PROJECT_NAME);
  });

  it("refuse de déployer sans nom de projet, sans appel à l'API", async () => {
    const { api, calls } = fakeVercelApi([createDeployment]);

    await expect(
      deployBranch(api, { ...SOURCE, projectName: "" }),
    ).rejects.toThrow(/sans nom/);
    expect(calls).toHaveLength(0);
  });

  it("lit le nom du projet chez Vercel, avec teamId", async () => {
    const { api, calls } = fakeVercelApi([projectRoute]);

    const name = await readProjectName(api);

    expect(name).toBe(PROJECT_NAME);
    expect(calls[0].path).toBe(`/v9/projects/${PROJECT}`);
    expect(calls[0].query.get("teamId")).toBe(TEAM);
  });

  it("échoue si le projet Vercel n'a pas de nom", async () => {
    const { api } = fakeVercelApi([{ ...projectRoute, body: { id: PROJECT } }]);

    await expect(readProjectName(api)).rejects.toThrow(
      /Projet Vercel sans nom/,
    );
  });

  it.each(["production", "staging"])(
    "échoue si Vercel crée un déploiement de cible %s",
    async (target) => {
      const { api } = fakeVercelApi([
        { ...createDeployment, body: { id: "dpl_new", target } },
      ]);

      await expect(deployBranch(api, SOURCE)).rejects.toThrow(
        /cible preview attendue/,
      );
    },
  );

  const cancelDeployment: Route = {
    method: "PATCH",
    path: /^\/v12\/deployments\/dpl_new\/cancel$/,
    body: { id: "dpl_new", readyState: "CANCELED" },
  };

  it("annule le déploiement de mauvaise cible avant de lever l'erreur", async () => {
    const { api, calls } = fakeVercelApi([
      { ...createDeployment, body: { id: "dpl_new", target: "production" } },
      cancelDeployment,
    ]);

    await expect(deployBranch(api, SOURCE)).rejects.toThrow(
      /cible preview attendue/,
    );

    const cancel = calls.find((c) => c.method === "PATCH");
    expect(cancel?.path).toBe("/v12/deployments/dpl_new/cancel");
    expect(cancel?.query.get("teamId")).toBe(TEAM);
  });

  it("garde l'erreur de cible si l'annulation échoue, sans citer projet ni déploiement", async () => {
    const { api } = fakeVercelApi([
      { ...createDeployment, body: { id: "dpl_new", target: "production" } },
      {
        ...cancelDeployment,
        status: 403,
        body: { error: { message: PROJECT } },
      },
    ]);

    const error = await deployBranch(api, SOURCE).then(
      () => new Error("aucune erreur"),
      (e: unknown) => e as Error,
    );

    expect(error.message).toMatch(/cible preview attendue/);
    expect(error.message).toMatch(/annulation en échec/);
    expect(error.message).not.toContain(PROJECT);
    expect(error.message).not.toContain("dpl_new");
  });

  it("n'annule rien quand la cible est preview", async () => {
    const { api, calls } = fakeVercelApi([createDeployment]);

    await deployBranch(api, SOURCE);

    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("attend READY puis renvoie l'origine de l'alias de branche", async () => {
    const { api, fetch } = fakeVercelApi([]);
    const states = [
      { readyState: "BUILDING", alias: [] },
      { readyState: "READY", aliasAssigned: false, alias: [] },
      READY,
    ];
    fetch.mockImplementation(async () =>
      Response.json({ id: "dpl_new", name: "autre", ...states.shift() }),
    );

    const origin = await waitForBranchOrigin(api, "dpl_new", PROJECT_NAME);

    expect(origin).toBe(`https://${BRANCH_ALIAS}`);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("trouve l'alias de branche par le nom du projet, jamais par le nom du déploiement", async () => {
    const { api } = fakeVercelApi([
      deploymentState({
        ...READY,
        alias: ["autre-git-feat-x-equipe.vercel.example", BRANCH_ALIAS],
      }),
    ]);

    const origin = await waitForBranchOrigin(api, "dpl_new", PROJECT_NAME);

    expect(origin).toBe(`https://${BRANCH_ALIAS}`);
  });

  it.each(["ERROR", "CANCELED"])(
    "échoue si le déploiement finit en %s",
    async (state) => {
      const { api } = fakeVercelApi([deploymentState({ readyState: state })]);

      await expect(
        waitForBranchOrigin(api, "dpl_new", PROJECT_NAME),
      ).rejects.toThrow(
        new RegExp(`Déploiement Vercel en échec \\(${state}\\)`),
      );
    },
  );

  it("échoue tout de suite si Vercel signale une erreur d'alias, sans en citer le message", async () => {
    const { api, fetch } = fakeVercelApi([
      deploymentState({
        readyState: "BUILDING",
        aliasError: { code: "alias_failed", message: `refusé ${BRANCH_ALIAS}` },
      }),
    ]);

    const error = await waitForBranchOrigin(api, "dpl_new", PROJECT_NAME).catch(
      (e: Error) => e,
    );

    expect(String(error)).toMatch(/erreur d'alias/);
    expect(String(error)).not.toContain("vercel.example");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("échoue si aucun alias de branche n'est attribué", async () => {
    const { api } = fakeVercelApi([
      deploymentState({
        readyState: "READY",
        aliasAssigned: true,
        alias: ["projet-antoine-equipe.vercel.example"],
      }),
    ]);

    const error = await waitForBranchOrigin(api, "dpl_new", PROJECT_NAME).catch(
      (e: Error) => e,
    );

    expect(String(error)).toMatch(/alias de branche introuvable/);
    expect(String(error)).not.toContain("vercel.example");
  });

  it("abandonne un déploiement trop long", async () => {
    const { api } = fakeVercelApi([
      deploymentState({ readyState: "BUILDING" }),
    ]);

    await expect(
      waitForBranchOrigin(api, "dpl_new", PROJECT_NAME),
    ).rejects.toThrow(/trop long/);
  });
});

describe("erreurs de l'API Vercel", () => {
  it("ne cite ni corps de réponse, ni projet, ni équipe, ni valeur", async () => {
    const { api } = fakeVercelApi([
      {
        method: "GET",
        path: /\/env$/,
        status: 403,
        body: { error: { message: `refusé pour ${NEON_HOST} ${PROJECT}` } },
      },
    ]);

    const error = await syncPreviewEnv(api, BRANCH, VALUES).catch(
      (e: Error) => e,
    );

    expect(String(error)).toMatch(/API Vercel : HTTP 403/);
    for (const leak of [NEON_HOST, PROJECT, TEAM, "npg_secret"]) {
      expect(String(error)).not.toContain(leak);
    }
  });

  it.each([429, 500, 503])(
    "réessaie un appel refusé par HTTP %i, avec une attente bornée",
    async (status) => {
      const { api, fetch } = fakeVercelApi([]);
      const sleeps: number[] = [];
      let failures = 2;
      fetch.mockImplementation(async () =>
        failures-- > 0
          ? Response.json({}, { status })
          : Response.json({ envs: [] }),
      );

      await deletePreviewEnv(
        { ...api, sleep: async (ms: number) => void sleeps.push(ms) },
        BRANCH,
      );

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(sleeps).toHaveLength(2);
      expect(sleeps.every((ms) => ms > 0 && ms <= 30_000)).toBe(true);
    },
  );

  it("abandonne après cinq réessais, sans citer le corps", async () => {
    const { api, fetch } = fakeVercelApi([
      { method: "GET", path: /\/env$/, status: 502, body: { host: NEON_HOST } },
    ]);
    const sleeps: number[] = [];

    const error = await deletePreviewEnv(
      { ...api, sleep: async (ms: number) => void sleeps.push(ms) },
      BRANCH,
    ).catch((e: Error) => e);

    expect(String(error)).toMatch(/API Vercel : HTTP 502 sur GET env/);
    expect(String(error)).not.toContain(NEON_HOST);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(30_000);
  });

  it("cite le code d'erreur Vercel d'une réponse 4xx, jamais son message", async () => {
    const { api } = fakeVercelApi([
      {
        method: "GET",
        path: /\/env$/,
        status: 400,
        body: {
          error: {
            code: "bad_request",
            message: `refusé ${PROJECT} ${NEON_HOST}`,
          },
        },
      },
    ]);

    const error = await deletePreviewEnv(api, BRANCH).catch((e: Error) => e);

    expect(String(error)).toMatch(
      /API Vercel : HTTP 400 sur GET env \(code bad_request\)\./,
    );
    for (const leak of [PROJECT, NEON_HOST, "refusé"]) {
      expect(String(error)).not.toContain(leak);
    }
  });

  it.each([
    ["un code hors du motif admis", { error: { code: `Bad ${NEON_HOST}` } }],
    ["un code trop long", { error: { code: "a".repeat(65) } }],
    ["un code qui n'est pas une chaîne", { error: { code: 42 } }],
    ["un corps sans code", { error: { message: "refusé" } }],
    ["un corps qui n'est pas du JSON", "pas du json"],
  ])("ne cite aucun code pour %s", async (_cas, body) => {
    const { api, fetch } = fakeVercelApi([]);
    fetch.mockImplementation(async () =>
      typeof body === "string"
        ? new Response(body, { status: 403 })
        : Response.json(body, { status: 403 }),
    );

    const error = await deletePreviewEnv(api, BRANCH).catch((e: Error) => e);

    expect(String(error)).toMatch(/API Vercel : HTTP 403 sur GET env\.$/);
  });

  it("ne cite pas le code d'une erreur 5xx", async () => {
    const { api } = fakeVercelApi([
      {
        method: "GET",
        path: /\/env$/,
        status: 502,
        body: { error: { code: "bad_gateway" } },
      },
    ]);

    const error = await deletePreviewEnv(api, BRANCH).catch((e: Error) => e);

    expect(String(error)).not.toContain("bad_gateway");
  });

  it("ne réessaie pas une erreur 4xx autre que 429", async () => {
    const { api, fetch } = fakeVercelApi([
      { method: "GET", path: /\/env$/, status: 400, body: {} },
    ]);

    await expect(deletePreviewEnv(api, BRANCH)).rejects.toThrow(/HTTP 400/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("borne chaque requête dans le temps et réessaie une requête expirée", async () => {
    const { api, fetch } = fakeVercelApi([]);
    let first = true;
    fetch.mockImplementation(async () => {
      if (first) {
        first = false;
        throw new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError",
        );
      }
      return Response.json({ envs: [] });
    });

    await deletePreviewEnv(api, BRANCH);

    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of fetch.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("abandonne une requête toujours en échec réseau, sans citer l'erreur d'origine", async () => {
    const { api, fetch } = fakeVercelApi([]);
    fetch.mockImplementation(async () => {
      throw new TypeError(`fetch failed ${NEON_HOST}`);
    });

    const error = await deletePreviewEnv(api, BRANCH).catch((e: Error) => e);

    expect(String(error)).toMatch(/API Vercel : pas de réponse sur GET env/);
    expect(String(error)).not.toContain(NEON_HOST);
    expect(fetch).toHaveBeenCalledTimes(6);
  });
});

describe("commandes", () => {
  function setup(routes: Route[]) {
    const dir = mkdtempSync(join(tmpdir(), "vercel-preview-"));
    const githubEnv = join(dir, "env");
    const vercel = fakeVercelApi(routes);
    const out: string[] = [];
    const writtenAtMask: string[] = [];
    const io = {
      fetch: vercel.fetch,
      sleep: async () => {},
      log: (line: string) => {
        out.push(line);
        if (line.startsWith("::add-mask::")) {
          writtenAtMask.push(
            existsSync(githubEnv) ? readFileSync(githubEnv, "utf8") : "",
          );
        }
      },
    };
    const env = {
      VERCEL_TOKEN: "jeton",
      VERCEL_PROJECT_ID: PROJECT,
      VERCEL_TEAM_ID: TEAM,
      DEFAULT_GIT_BRANCH: "main",
      GITHUB_ENV: githubEnv,
      ...VALUES,
    };
    const masks = () =>
      out.filter((l) => l.startsWith("::add-mask::")).map((l) => l.slice(12));
    const plain = () =>
      out.filter((l) => !l.startsWith("::add-mask::")).join("\n");
    return { ...vercel, out, io, env, githubEnv, writtenAtMask, masks, plain };
  }

  it("sync : masque projet, équipe et valeurs, puis pose les variables sans rien afficher", async () => {
    const { io, env, calls, masks, plain } = setup([envList([]), createEnv]);

    await run(["sync", BRANCH], env, io);

    expect(masks()).toEqual(
      expect.arrayContaining([PROJECT, TEAM, ...Object.values(VALUES)]),
    );
    expect(calls.some((c) => c.method === "POST")).toBe(true);
    for (const leak of [PROJECT, TEAM, NEON_HOST, "npg_secret"]) {
      expect(plain()).not.toContain(leak);
    }
  });

  it("deploy : redéploie, attend l'alias, le masque puis l'écrit dans la variable demandée", async () => {
    const { io, env, githubEnv, masks, plain, writtenAtMask } = setup([
      createDeployment,
      projectRoute,
      deploymentState({
        readyState: "READY",
        aliasAssigned: true,
        alias: [BRANCH_ALIAS],
      }),
    ]);

    await run(
      ["deploy", BRANCH, "--origin-env", "PREVIEW_ORIGIN"],
      { ...env, HEAD_SHA: "abc123", GITHUB_REPOSITORY_ID: "42" },
      io,
    );

    expect(masks()).toEqual(
      expect.arrayContaining([
        BRANCH_ALIAS,
        `https://${BRANCH_ALIAS}`,
        "dpl_new",
      ]),
    );
    expect(writtenAtMask.every((content) => content === "")).toBe(true);
    expect(readFileSync(githubEnv, "utf8")).toBe(
      `PREVIEW_ORIGIN=https://${BRANCH_ALIAS}\n`,
    );
    expect(plain()).not.toContain("vercel.example");
  });

  it("deploy : lit le nom du projet une seule fois, avant de déployer", async () => {
    const { io, env, calls } = setup([
      createDeployment,
      projectRoute,
      deploymentState(READY),
    ]);

    await run(
      ["deploy", BRANCH, "--origin-env", "PREVIEW_ORIGIN"],
      { ...env, HEAD_SHA: "abc123", GITHUB_REPOSITORY_ID: "42" },
      io,
    );

    const projectReads = calls.filter(
      (c) => c.path === `/v9/projects/${PROJECT}`,
    );
    expect(projectReads).toHaveLength(1);
    expect(calls.indexOf(projectReads[0])).toBeLessThan(
      calls.findIndex((c) => c.method === "POST"),
    );
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
      name: PROJECT_NAME,
    });
  });

  it("deploy : exige le commit de la PR et l'identifiant du dépôt", async () => {
    const { io, env, calls } = setup([createDeployment]);

    await expect(
      run(["deploy", BRANCH, "--origin-env", "PREVIEW_ORIGIN"], env, io),
    ).rejects.toThrow(/HEAD_SHA manquante/);
    expect(calls).toHaveLength(0);
  });

  it("delete : supprime les variables de la branche sans exiger leurs valeurs", async () => {
    const { io, calls } = setup([
      envList([branchVar("NEON_AUTH_ISSUER")]),
      removeEnv,
    ]);

    await run(
      ["delete", BRANCH],
      {
        VERCEL_TOKEN: "jeton",
        VERCEL_PROJECT_ID: PROJECT,
        VERCEL_TEAM_ID: TEAM,
        DEFAULT_GIT_BRANCH: "main",
      },
      io,
    );

    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
  });

  it("refuse une commande inconnue et un jeton manquant", async () => {
    const { io, env } = setup([]);

    await expect(run(["purge", BRANCH], env, io)).rejects.toThrow(
      /Commande inconnue/,
    );
    await expect(
      run(["sync", BRANCH], { ...env, VERCEL_TOKEN: "" }, io),
    ).rejects.toThrow(/VERCEL_TOKEN manquante/);
  });

  it.each(["sync", "deploy", "delete"])(
    "%s : refuse la branche par défaut du dépôt, sans appel à l'API",
    async (command) => {
      const { io, env, calls } = setup([
        envList([]),
        createEnv,
        createDeployment,
      ]);

      await expect(
        run(
          [command, "main", "--origin-env", "PREVIEW_ORIGIN"],
          { ...env, HEAD_SHA: "abc123", GITHUB_REPOSITORY_ID: "42" },
          io,
        ),
      ).rejects.toThrow(/branche par défaut/);
      expect(calls).toHaveLength(0);
    },
  );

  it("exige le nom de la branche par défaut du dépôt", async () => {
    const { io, env, calls } = setup([envList([]), createEnv]);

    await expect(
      run(["sync", BRANCH], { ...env, DEFAULT_GIT_BRANCH: "" }, io),
    ).rejects.toThrow(/DEFAULT_GIT_BRANCH manquante/);
    expect(calls).toHaveLength(0);
  });
});
