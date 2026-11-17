// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  assertManagedBranchName,
  createBranch,
  deleteBranch,
  getAuthConfig,
  run,
  trustOrigin,
  redactPath,
  withRole,
} from "./neon-branch.mjs";

// Valeurs fictives : aucun hôte, projet ni mot de passe réel.
const ENDPOINT = "ep-fake-123";
const HOST = `${ENDPOINT}.eu-central-1.aws.neon.example`;
// Gabarit renvoyé par connection_uri : son mot de passe n'est jamais réutilisé.
const TEMPLATE_URI = `postgresql://neondb_owner:hérité%2Fpw@${HOST}/neondb?sslmode=require&channel_binding=require`;
const OWNER_PASSWORD = "npg_owner/neuf";
const APP_PASSWORD = "npg_app+neuf";
const BASE_ENV = {
  NEON_API_KEY: "api-key",
  NEON_PROJECT_ID: "proj-fake",
  DEFAULT_GIT_BRANCH: "main",
};

type Route = {
  method: string;
  path: RegExp;
  status?: number;
  body: unknown;
  empty?: boolean;
};
type Call = { method: string; path: string; body?: unknown };

/** Faux client HTTP de l'API Neon : chaque appel doit correspondre à une route (sinon 404). */
function fakeNeonApi(routes: Route[]) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname + url.search;
    const method = init?.method ?? "GET";
    calls.push({
      method,
      path,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const route = routes.find((r) => r.method === method && r.path.test(path));
    if (!route) return Response.json({ message: "inconnu" }, { status: 404 });
    if (route.empty) return new Response(null, { status: route.status ?? 200 });
    return Response.json(route.body, { status: route.status ?? 200 });
  });
  return {
    fetch,
    calls,
    api: { apiKey: "k", projectId: "p", fetch, sleep: async () => {} },
  };
}

const parentRoute = (name: string): Route => ({
  method: "GET",
  path: new RegExp(`/branches\\?search=${name}$`),
  body: {
    branches: [{ id: `br-${name}`, name, default: name === "production" }],
  },
});
const listing = (branches: object[]): Route => ({
  method: "GET",
  path: /\/branches\?search=(ci|preview)/,
  body: { branches },
});
const createRoute = (id: string): Route => ({
  method: "POST",
  path: /\/branches$/,
  status: 201,
  body: {
    branch: { id },
    operations: [{ id: "op-create", status: "running" }],
  },
});
const resetRoute = (role: string, password: string): Route => ({
  method: "POST",
  path: new RegExp(`/branches/br-[\\w-]+/roles/${role}/reset_password$`),
  body: {
    role: { name: role, password },
    operations: [{ id: `op-${role}`, status: "running" }],
  },
});
const operationsDone: Route = {
  method: "GET",
  path: /\/operations\/op-/,
  body: { operation: { status: "finished" } },
};
const connectionUri: Route = {
  method: "GET",
  path: /\/connection_uri\?/,
  body: { uri: TEMPLATE_URI },
};
const OPTIONS = {
  parent: "test",
  database: "neondb",
  ownerRole: "neondb_owner",
  appRole: "app_backend",
};

function newBranchApi(id = "br-new") {
  return fakeNeonApi([
    parentRoute("test"),
    parentRoute("production"),
    listing([]),
    createRoute(id),
    resetRoute("neondb_owner", OWNER_PASSWORD),
    resetRoute("app_backend", APP_PASSWORD),
    operationsDone,
    connectionUri,
  ]);
}

describe("noms de branche gérés par la CI", () => {
  it.each(["ci/run-12-1", "preview/feat/socle", "preview/fix-x_1.2"])(
    "accepte %s",
    (name) => {
      expect(() => assertManagedBranchName(name)).not.toThrow();
    },
  );

  it.each([
    "production",
    "main",
    "dev",
    "test",
    "preview/",
    "ci/../production",
    "preview/a b",
  ])("refuse %s", (name) => {
    expect(() => assertManagedBranchName(name)).toThrow(/ci\/ ou preview\//);
  });
});

describe("URL d'un rôle", () => {
  it("garde l'hôte et la base du gabarit, change rôle et mot de passe", () => {
    const url = new URL(withRole(TEMPLATE_URI, "app_backend", "p@ss/word"));

    expect(url.hostname).toBe(HOST);
    expect(url.pathname).toBe("/neondb");
    expect(url.username).toBe("app_backend");
    expect(decodeURIComponent(url.password)).toBe("p@ss/word");
    expect(url.searchParams.get("sslmode")).toBe("require");
  });
});

describe("création d'une branche", () => {
  it("crée la branche depuis le parent nommé, avec un calcul et une expiration", async () => {
    const { api, calls } = newBranchApi();

    await createBranch(api, {
      ...OPTIONS,
      name: "ci/run-1-1",
      expiresAt: "2026-11-12T08:00:00Z",
    });

    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      branch: {
        name: "ci/run-1-1",
        parent_id: "br-test",
        expires_at: "2026-11-12T08:00:00Z",
      },
      endpoints: [{ type: "read_write" }],
    });
  });

  it("réinitialise les mots de passe du propriétaire et d'app_backend sur la branche fille avant de produire les URL", async () => {
    const { api, calls } = newBranchApi();

    const result = await createBranch(api, { ...OPTIONS, name: "ci/run-1-1" });

    const resets = calls
      .map((c, index) => ({ ...c, index }))
      .filter((c) => c.path.endsWith("/reset_password"));
    expect(resets.map((c) => c.path)).toEqual([
      "/api/v2/projects/p/branches/br-new/roles/neondb_owner/reset_password",
      "/api/v2/projects/p/branches/br-new/roles/app_backend/reset_password",
    ]);
    const uriIndex = calls.findIndex((c) => c.path.includes("/connection_uri"));
    expect(resets.every((r) => r.index < uriIndex)).toBe(true);
    expect(decodeURIComponent(new URL(result.ownerUrl).password)).toBe(
      OWNER_PASSWORD,
    );
    expect(decodeURIComponent(new URL(result.appUrl).password)).toBe(
      APP_PASSWORD,
    );
    expect(new URL(result.appUrl).username).toBe("app_backend");
  });

  it("ne réinitialise jamais un mot de passe sur la branche parente ni sur production", async () => {
    const { api, calls } = newBranchApi();

    await createBranch(api, {
      ...OPTIONS,
      parent: "production",
      name: "preview/feat/x",
    });

    const writes = calls.filter((c) => c.method !== "GET");
    expect(writes.some((c) => /br-(production|test)\b/.test(c.path))).toBe(
      false,
    );
  });

  it("attend la fin des opérations de création avant de réinitialiser les mots de passe", async () => {
    const { api } = newBranchApi();
    const original = api.fetch.getMockImplementation()!;
    let polls = 0;
    let resetBeforeFinished = false;
    api.fetch.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/operations/op-create")) {
        polls += 1;
        return Response.json({
          operation: { status: polls >= 2 ? "finished" : "running" },
        });
      }
      if (url.endsWith("/reset_password") && polls < 2)
        resetBeforeFinished = true;
      return original(input, init);
    });

    await createBranch(api, { ...OPTIONS, name: "ci/run-1-1" });

    expect(polls).toBe(2);
    expect(resetBeforeFinished).toBe(false);
  });

  it("échoue si une opération Neon échoue", async () => {
    const { api } = fakeNeonApi([
      parentRoute("test"),
      listing([]),
      createRoute("br-new"),
      {
        method: "GET",
        path: /\/operations\/op-create$/,
        body: { operation: { status: "failed" } },
      },
    ]);

    await expect(
      createBranch(api, { ...OPTIONS, name: "ci/run-1-1" }),
    ).rejects.toThrow(/opération Neon en échec/);
  });

  it("réessaie un appel refusé par 423 (projet verrouillé par une opération)", async () => {
    const { api } = newBranchApi();
    const original = api.fetch.getMockImplementation()!;
    let locked = true;
    api.fetch.mockImplementation(async (input, init) => {
      if (
        init?.method === "POST" &&
        String(input).endsWith("/branches") &&
        locked
      ) {
        locked = false;
        return Response.json({}, { status: 423 });
      }
      return original(input, init);
    });

    const result = await createBranch(api, { ...OPTIONS, name: "ci/run-1-1" });

    expect(result.branchId).toBe("br-new");
  });

  it("réutilise une branche existante du même nom et repousse son expiration", async () => {
    const { api, calls } = fakeNeonApi([
      listing([{ id: "br-preview", name: "preview/feat/x" }]),
      {
        method: "PATCH",
        path: /\/branches\/br-preview$/,
        body: { branch: { id: "br-preview" }, operations: [] },
      },
      resetRoute("neondb_owner", OWNER_PASSWORD),
      resetRoute("app_backend", APP_PASSWORD),
      operationsDone,
      connectionUri,
    ]);

    const result = await createBranch(api, {
      ...OPTIONS,
      parent: "production",
      name: "preview/feat/x",
      expiresAt: "2026-11-22T08:00:00Z",
    });

    expect(
      calls.some((c) => c.method === "POST" && c.path.endsWith("/branches")),
    ).toBe(false);
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      branch: { expires_at: "2026-11-22T08:00:00Z" },
    });
    expect(result).toMatchObject({ branchId: "br-preview", created: false });
  });

  it("réinitialise les deux mots de passe sur une branche ci/ retrouvée (job relancé)", async () => {
    const { api, calls } = fakeNeonApi([
      listing([{ id: "br-ci-run", name: "ci/run-42" }]),
      resetRoute("neondb_owner", OWNER_PASSWORD),
      resetRoute("app_backend", APP_PASSWORD),
      operationsDone,
      connectionUri,
    ]);

    const result = await createBranch(api, { ...OPTIONS, name: "ci/run-42" });

    const resets = calls
      .filter((c) => c.path.endsWith("/reset_password"))
      .map((c) => c.path);
    expect(resets).toEqual([
      expect.stringContaining("/branches/br-ci-run/roles/neondb_owner/"),
      expect.stringContaining("/branches/br-ci-run/roles/app_backend/"),
    ]);
    expect(result).toMatchObject({
      branchId: "br-ci-run",
      created: false,
      ownerPassword: OWNER_PASSWORD,
      appPassword: APP_PASSWORD,
    });
  });

  it("refuse une branche existante par défaut ou protégée, sans rien modifier", async () => {
    const { api, calls } = fakeNeonApi([
      listing([{ id: "br-x", name: "preview/x", protected: true }]),
    ]);

    await expect(
      createBranch(api, { ...OPTIONS, name: "preview/x" }),
    ).rejects.toThrow(/protégée ou par défaut/);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("n'inclut jamais la réponse de l'API dans son message d'erreur", async () => {
    const { api } = fakeNeonApi([
      {
        method: "GET",
        path: /\/branches\?search=/,
        status: 500,
        body: { message: `hôte ${HOST}` },
      },
    ]);

    const error = await createBranch(api, {
      ...OPTIONS,
      name: "preview/x",
    }).catch((e: Error) => e);

    expect(String(error)).toMatch(/HTTP 500/);
    expect(String(error)).not.toContain(HOST);
  });
});

describe("chemins cités dans les erreurs", () => {
  it("remplace chaque identifiant de branche et chaque rôle, pas seulement le premier", () => {
    const redacted = redactPath(
      "/branches/br-aaa-1/roles/neondb_owner/x/br-bbb-2/roles/app_backend?q=br-ccc",
    );

    expect(redacted).toBe(
      "/branches/<branche>/roles/<rôle>/x/<branche>/roles/<rôle>",
    );
  });
});

describe("suppression d'une branche", () => {
  it("supprime la branche trouvée par son nom", async () => {
    const { api, calls } = fakeNeonApi([
      listing([{ id: "br-ci", name: "ci/run-1-1" }]),
      { method: "DELETE", path: /\/branches\/br-ci$/, body: {} },
    ]);

    const deleted = await deleteBranch(api, "ci/run-1-1");

    expect(deleted).toBe(true);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("ne fait rien si la branche n'existe plus", async () => {
    const { api, calls } = fakeNeonApi([listing([])]);

    const deleted = await deleteBranch(api, "ci/run-1-1");

    expect(deleted).toBe(false);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});

describe("commande create", () => {
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "neon-branch-"));
    const githubEnv = join(dir, "env");
    const githubOutput = join(dir, "output");
    const { fetch } = newBranchApi();
    const out: string[] = [];
    const env = {
      ...BASE_ENV,
      GITHUB_ENV: githubEnv,
      GITHUB_OUTPUT: githubOutput,
    };
    const io = {
      fetch,
      log: (line: string) => out.push(line),
      sleep: async () => {},
    };
    return { fetch, out, env, io, githubEnv, githubOutput };
  }
  const ARGS = [
    "--owner-env",
    "DATABASE_TEST_URL",
    "--app-env",
    "DATABASE_TEST_AUTHENTICATED_URL",
  ];

  it("masque hôte, endpoint, mots de passe et URL avant d'écrire les variables de la branche", async () => {
    const { out, env, io, githubEnv } = setup();

    await run(["create", "ci/run-1-1", ...ARGS, "--ttl-hours", "2"], env, io);

    const masks = out
      .filter((l) => l.startsWith("::add-mask::"))
      .map((l) => l.slice(12));
    const ownerUrl = withRole(TEMPLATE_URI, "neondb_owner", OWNER_PASSWORD);
    const appUrl = withRole(TEMPLATE_URI, "app_backend", APP_PASSWORD);
    expect(masks).toEqual(
      expect.arrayContaining([
        HOST,
        `${ENDPOINT}-pooler.eu-central-1.aws.neon.example`,
        ENDPOINT,
        `${ENDPOINT}-pooler`,
        OWNER_PASSWORD,
        encodeURIComponent(OWNER_PASSWORD),
        APP_PASSWORD,
        encodeURIComponent(APP_PASSWORD),
        TEMPLATE_URI,
        ownerUrl,
        appUrl,
      ]),
    );
    const written = readFileSync(githubEnv, "utf8");
    expect(written).toBe(
      `DATABASE_TEST_URL=${ownerUrl}\nDATABASE_TEST_AUTHENTICATED_URL=${appUrl}\n`,
    );
    const plain = out.filter((l) => !l.startsWith("::add-mask::")).join("\n");
    expect(plain).not.toContain(ENDPOINT);
    expect(plain).not.toContain(OWNER_PASSWORD);
  });

  it("prend la branche test pour parent par défaut, ou NEON_PARENT_BRANCH", async () => {
    const byDefault = setup();
    const explicit = setup();

    await run(["create", "ci/run-1-1", ...ARGS], byDefault.env, byDefault.io);
    await run(
      ["create", "preview/x", ...ARGS],
      { ...explicit.env, NEON_PARENT_BRANCH: "production" },
      explicit.io,
    );

    const parentOf = (fetch: typeof byDefault.fetch) =>
      (fetch.mock.calls.find(([, init]) => init?.method === "POST")?.[1]
        ?.body as string) ?? "";
    expect(JSON.parse(parentOf(byDefault.fetch)).branch.parent_id).toBe(
      "br-test",
    );
    expect(JSON.parse(parentOf(explicit.fetch)).branch.parent_id).toBe(
      "br-production",
    );
  });

  it("sans --owner-env, réinitialise quand même le propriétaire mais n'écrit que l'URL app_backend", async () => {
    const { fetch, env, io, githubEnv } = setup();

    await run(
      ["create", "ci/run-1-1", "--app-env", "DATABASE_TEST_AUTHENTICATED_URL"],
      env,
      io,
    );

    const resets = fetch.mock.calls
      .map(([input]) => new URL(String(input)).pathname)
      .filter((path) => path.endsWith("/reset_password"));
    expect(resets).toHaveLength(2);
    expect(readFileSync(githubEnv, "utf8")).toBe(
      `DATABASE_TEST_AUTHENTICATED_URL=${withRole(TEMPLATE_URI, "app_backend", APP_PASSWORD)}\n`,
    );
  });

  it("sans --app-env, réinitialise quand même app_backend mais n'écrit que l'URL propriétaire", async () => {
    const { fetch, env, io, githubEnv, out } = setup();

    await run(["create", "preview/x", "--owner-env", "DATABASE_URL"], env, io);

    const resets = fetch.mock.calls
      .map(([input]) => new URL(String(input)).pathname)
      .filter((path) => path.endsWith("/reset_password"));
    expect(resets).toHaveLength(2);
    expect(readFileSync(githubEnv, "utf8")).toBe(
      `DATABASE_URL=${withRole(TEMPLATE_URI, "neondb_owner", OWNER_PASSWORD)}\n`,
    );
    expect(out).toContain(`::add-mask::${APP_PASSWORD}`);
  });

  it("refuse create sans --owner-env, --app-env ni --auth-env, sans appel à l'API", async () => {
    const { fetch, env, io } = setup();

    await expect(run(["create", "ci/run-1"], env, io)).rejects.toThrow(
      /--owner-env, --app-env ou --auth-env/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("publie l'identifiant de la branche en sortie de l'étape", async () => {
    const { env, io, githubOutput } = setup();

    await run(["create", "ci/run-1-1", ...ARGS], env, io);

    expect(readFileSync(githubOutput, "utf8")).toContain("branch_id=br-new\n");
  });

  it("refuse de cibler une branche hors ci/ et preview/", async () => {
    const { fetch, env, io } = setup();

    await expect(
      run(["create", "production", ...ARGS], env, io),
    ).rejects.toThrow(/ci\/ ou preview\//);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["create", "trust", "delete"])(
    "%s : refuse la preview de la branche par défaut du dépôt, sans appel à l'API",
    async (command) => {
      const { fetch, env, io } = setup();

      await expect(
        run(
          [command, "preview/main", ...ARGS],
          { ...env, TRUSTED_ORIGIN: "https://projet.vercel.example" },
          io,
        ),
      ).rejects.toThrow(/branche par défaut/);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("exige le nom de la branche par défaut pour une branche preview/, pas pour ci/", async () => {
    const { fetch, env, io } = setup();
    const withoutDefault = { ...env, DEFAULT_GIT_BRANCH: "" };

    await expect(
      run(["create", "preview/feat/x", ...ARGS], withoutDefault, io),
    ).rejects.toThrow(/DEFAULT_GIT_BRANCH manquante/);
    expect(fetch).not.toHaveBeenCalled();
    await run(["create", "ci/run-1-1", ...ARGS], withoutDefault, io);
  });
});

// Neon Auth de la branche fille : sa propre instance (doc Neon « Branching authentication »).
const AUTH_HOST = `${ENDPOINT}.neonauth.eu-central-1.aws.neon.example`;
const AUTH_BASE_URL = `https://${AUTH_HOST}/neondb/auth`;
const AUTH_JWKS_URL = `${AUTH_BASE_URL}/.well-known/jwks.json`;
const authRoute = (branchId: string, status = 200): Route => ({
  method: "GET",
  path: new RegExp(`/branches/${branchId}/auth$`),
  status,
  body:
    status === 200
      ? {
          auth_provider: "better_auth",
          branch_id: branchId,
          base_url: AUTH_BASE_URL,
          jwks_url: AUTH_JWKS_URL,
        }
      : { message: `pas d'auth sur ${AUTH_HOST}` },
});

describe("configuration Neon Auth de la branche", () => {
  it("lit base_url et jwks_url de la branche ; iss et aud valent l'origine de base_url", async () => {
    const { api, calls } = fakeNeonApi([authRoute("br-new")]);

    const auth = await getAuthConfig(api, "br-new");

    expect(calls[0]).toMatchObject({
      method: "GET",
      path: "/api/v2/projects/p/branches/br-new/auth",
    });
    expect(auth).toEqual({
      baseUrl: AUTH_BASE_URL,
      jwksUrl: AUTH_JWKS_URL,
      issuer: `https://${AUTH_HOST}`,
      audience: `https://${AUTH_HOST}`,
    });
  });

  it("échoue explicitement, sans hôte, si Neon Auth n'est pas provisionné sur la branche", async () => {
    const { api } = fakeNeonApi([authRoute("br-new", 404)]);

    const error = await getAuthConfig(api, "br-new").catch((e: Error) => e);

    expect(String(error)).toMatch(/Neon Auth absent de la branche/);
    expect(String(error)).not.toContain(AUTH_HOST);
    expect(String(error)).not.toContain(ENDPOINT);
  });

  it("refuse une configuration dont le JWKS n'est pas sur l'hôte de base_url", async () => {
    const { api } = fakeNeonApi([
      {
        method: "GET",
        path: /\/auth$/,
        body: {
          base_url: AUTH_BASE_URL,
          jwks_url: "https://autre.example/jwks.json",
        },
      },
    ]);

    const error = await getAuthConfig(api, "br-new").catch((e: Error) => e);

    expect(String(error)).toMatch(/configuration Neon Auth inattendue/);
    expect(String(error)).not.toContain(AUTH_HOST);
  });
});

describe("commande create --auth-env", () => {
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "neon-branch-auth-"));
    const githubEnv = join(dir, "env");
    const api = fakeNeonApi([
      parentRoute("production"),
      listing([]),
      createRoute("br-new"),
      resetRoute("neondb_owner", OWNER_PASSWORD),
      resetRoute("app_backend", APP_PASSWORD),
      operationsDone,
      connectionUri,
      authRoute("br-new"),
    ]);
    const out: string[] = [];
    const writtenAtMask: string[] = [];
    const io = {
      fetch: api.fetch,
      log: (line: string) => {
        out.push(line);
        if (line.startsWith("::add-mask::")) {
          writtenAtMask.push(
            existsSync(githubEnv) ? readFileSync(githubEnv, "utf8") : "",
          );
        }
      },
      sleep: async () => {},
    };
    const env = {
      ...BASE_ENV,
      GITHUB_ENV: githubEnv,
      NEON_PARENT_BRANCH: "production",
    };
    return { out, io, env, githubEnv, writtenAtMask };
  }
  const ARGS = [
    "--owner-env",
    "DATABASE_URL",
    "--app-env",
    "DATABASE_AUTHENTICATED_URL",
    "--auth-env",
  ];

  it("écrit les quatre NEON_AUTH_* de la branche dans $GITHUB_ENV", async () => {
    const { env, io, githubEnv } = setup();

    await run(["create", "preview/feat/x", ...ARGS], env, io);

    const written = readFileSync(githubEnv, "utf8");
    expect(written).toContain(`NEON_AUTH_BASE_URL=${AUTH_BASE_URL}\n`);
    expect(written).toContain(`NEON_AUTH_JWKS_URL=${AUTH_JWKS_URL}\n`);
    expect(written).toContain(`NEON_AUTH_ISSUER=https://${AUTH_HOST}\n`);
    expect(written).toContain(`NEON_AUTH_AUDIENCE=https://${AUTH_HOST}\n`);
  });

  it("masque l'hôte, l'origine et les URL Neon Auth avant toute écriture", async () => {
    const { out, env, io, writtenAtMask } = setup();

    await run(["create", "preview/feat/x", ...ARGS], env, io);

    const masks = out
      .filter((l) => l.startsWith("::add-mask::"))
      .map((l) => l.slice(12));
    expect(masks).toEqual(
      expect.arrayContaining([
        AUTH_HOST,
        `https://${AUTH_HOST}`,
        AUTH_BASE_URL,
        AUTH_JWKS_URL,
      ]),
    );
    expect(writtenAtMask.every((content) => content === "")).toBe(true);
    const plain = out.filter((l) => !l.startsWith("::add-mask::")).join("\n");
    expect(plain).not.toContain(AUTH_HOST);
  });

  it("n'écrit aucune variable si Neon Auth manque sur la branche", async () => {
    const { env, io, githubEnv } = setup();
    const original = io.fetch.getMockImplementation()!;
    io.fetch.mockImplementation(async (input, init) =>
      String(input).endsWith("/auth")
        ? Response.json({}, { status: 404 })
        : original(input, init),
    );

    await expect(
      run(["create", "preview/feat/x", ...ARGS], env, io),
    ).rejects.toThrow(/Neon Auth absent/);
    expect(existsSync(githubEnv)).toBe(false);
  });
});

describe("domaine de confiance Neon Auth", () => {
  const ORIGIN = "https://projet-git-feat-x-equipe.vercel.example";
  const domainsRoute = (domains: string[]): Route => ({
    method: "GET",
    path: /\/branches\/br-preview\/auth\/domains$/,
    body: {
      domains: domains.map((domain) => ({
        domain,
        auth_provider: "better_auth",
      })),
    },
  });
  const addDomainRoute: Route = {
    method: "POST",
    path: /\/branches\/br-preview\/auth\/domains$/,
    status: 201,
    body: {},
  };
  const previewListing = listing([
    { id: "br-preview", name: "preview/feat/x" },
  ]);

  it("ajoute l'origine de la preview à la branche preview", async () => {
    const { api, calls } = fakeNeonApi([
      previewListing,
      domainsRoute([]),
      addDomainRoute,
    ]);

    const added = await trustOrigin(api, "preview/feat/x", ORIGIN);

    expect(added).toBe(true);
    expect(calls.find((c) => c.method === "POST")).toEqual({
      method: "POST",
      path: "/api/v2/projects/p/branches/br-preview/auth/domains",
      body: { domain: ORIGIN, auth_provider: "better_auth" },
    });
  });

  it("accepte une réponse sans corps à l'ajout du domaine (201 vide)", async () => {
    const { api } = fakeNeonApi([
      previewListing,
      domainsRoute([]),
      { ...addDomainRoute, status: 201, empty: true },
    ]);

    const added = await trustOrigin(api, "preview/feat/x", ORIGIN);

    expect(added).toBe(true);
  });

  it("lit une liste de domaines sans corps comme une liste vide", async () => {
    const { api, calls } = fakeNeonApi([
      previewListing,
      { ...domainsRoute([]), empty: true },
      addDomainRoute,
    ]);

    await trustOrigin(api, "preview/feat/x", ORIGIN);

    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("ne rajoute pas une origine déjà présente (idempotent)", async () => {
    const { api, calls } = fakeNeonApi([
      previewListing,
      domainsRoute([ORIGIN]),
      addDomainRoute,
    ]);

    const added = await trustOrigin(api, "preview/feat/x", ORIGIN);

    expect(added).toBe(false);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it.each([
    "http://projet.vercel.example",
    "https://projet.vercel.example/chemin",
    "https://projet.vercel.example/",
    "https://*.vercel.example",
    "pas une url",
  ])("refuse %s (origine https exacte attendue)", async (origin) => {
    const { api, calls } = fakeNeonApi([previewListing, domainsRoute([])]);

    await expect(trustOrigin(api, "preview/feat/x", origin)).rejects.toThrow(
      /origine https/,
    );
    expect(calls).toHaveLength(0);
  });

  it.each([{ default: true }, { protected: true }])(
    "refuse une branche %o, sans lire ni modifier ses domaines",
    async (flags) => {
      const { api, calls } = fakeNeonApi([
        listing([{ id: "br-preview", name: "preview/feat/x", ...flags }]),
        domainsRoute([]),
        addDomainRoute,
      ]);

      await expect(trustOrigin(api, "preview/feat/x", ORIGIN)).rejects.toThrow(
        /protégée ou par défaut/,
      );
      expect(calls).toHaveLength(1);
    },
  );

  it("refuse une branche hors preview/ et ci/, et une branche absente", async () => {
    const { api } = fakeNeonApi([listing([])]);

    await expect(trustOrigin(api, "production", ORIGIN)).rejects.toThrow(
      /ci\/ ou preview\//,
    );
    await expect(trustOrigin(api, "preview/feat/x", ORIGIN)).rejects.toThrow(
      /introuvable/,
    );
  });

  it("commande trust : lit l'origine dans TRUSTED_ORIGIN et ne l'affiche pas", async () => {
    const { fetch, calls } = fakeNeonApi([
      previewListing,
      domainsRoute([]),
      addDomainRoute,
    ]);
    const out: string[] = [];

    await run(
      ["trust", "preview/feat/x"],
      { ...BASE_ENV, TRUSTED_ORIGIN: ORIGIN },
      { fetch, log: (l) => out.push(l), sleep: async () => {} },
    );

    expect(calls.some((c) => c.method === "POST")).toBe(true);
    expect(out.join("\n")).not.toContain("vercel.example");
  });
});
