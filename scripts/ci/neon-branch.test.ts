// @vitest-environment node
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  assertManagedBranchName,
  createBranch,
  deleteBranch,
  run,
  withRole,
} from "./neon-branch.mjs";

// Valeurs fictives : aucun hôte ni projet réel.
const HOST = "ep-fake-123.eu-central-1.aws.neon.example";
const OWNER_URI = `postgresql://neondb_owner:owner%2Fpw@${HOST}/neondb?sslmode=require&channel_binding=require`;
const BASE_ENV = {
  NEON_API_KEY: "api-key",
  NEON_PROJECT_ID: "proj-fake",
  APP_BACKEND_PASSWORD: "app pw/+",
};

type Route = { method: string; path: RegExp; status?: number; body: unknown };

/** Faux client HTTP de l'API Neon : chaque appel doit correspondre à une route. */
function fakeNeonApi(routes: Route[]) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({
      method,
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const route = routes.find(
      (r) =>
        r.method === method &&
        r.path.test(new URL(url).pathname + new URL(url).search),
    );
    if (!route) return Response.json({ message: "inconnu" }, { status: 404 });
    return Response.json(route.body, { status: route.status ?? 200 });
  });
  return { fetch, calls };
}

const listing = (branches: object[]): Route => ({
  method: "GET",
  path: /\/branches\?search=/,
  body: { branches },
});
const connectionUri: Route = {
  method: "GET",
  path: /\/connection_uri\?/,
  body: { uri: OWNER_URI },
};

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

describe("URL du rôle app_backend", () => {
  it("garde l'hôte et la base de l'URL propriétaire, change rôle et mot de passe", () => {
    const url = new URL(withRole(OWNER_URI, "app_backend", "p@ss/word"));

    expect(url.hostname).toBe(HOST);
    expect(url.pathname).toBe("/neondb");
    expect(url.username).toBe("app_backend");
    expect(decodeURIComponent(url.password)).toBe("p@ss/word");
    expect(url.searchParams.get("sslmode")).toBe("require");
  });
});

describe("création d'une branche", () => {
  it("crée la branche depuis le parent nommé, avec un calcul et une expiration", async () => {
    const api = fakeNeonApi([
      {
        method: "GET",
        path: /\/branches\?search=production/,
        body: {
          branches: [{ id: "br-prod", name: "production", default: true }],
        },
      },
      listing([]),
      {
        method: "POST",
        path: /\/branches$/,
        status: 201,
        body: { branch: { id: "br-new", name: "ci/run-1-1" } },
      },
      connectionUri,
    ]);

    const result = await createBranch(
      { apiKey: "k", projectId: "p", fetch: api.fetch },
      {
        name: "ci/run-1-1",
        parent: "production",
        database: "neondb",
        ownerRole: "neondb_owner",
        expiresAt: "2026-11-12T08:00:00Z",
      },
    );

    const post = api.calls.find((c) => c.method === "POST");
    expect(post?.body).toEqual({
      branch: {
        name: "ci/run-1-1",
        parent_id: "br-prod",
        expires_at: "2026-11-12T08:00:00Z",
      },
      endpoints: [{ type: "read_write" }],
    });
    expect(result).toEqual({
      branchId: "br-new",
      created: true,
      ownerUrl: OWNER_URI,
    });
  });

  it("réutilise une branche existante du même nom sans en créer une autre", async () => {
    const api = fakeNeonApi([
      listing([{ id: "br-preview", name: "preview/feat/x" }]),
      connectionUri,
    ]);

    const result = await createBranch(
      { apiKey: "k", projectId: "p", fetch: api.fetch },
      {
        name: "preview/feat/x",
        parent: "production",
        database: "neondb",
        ownerRole: "neondb_owner",
      },
    );

    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
    expect(result.branchId).toBe("br-preview");
    expect(result.created).toBe(false);
  });

  it("refuse une branche existante par défaut ou protégée", async () => {
    const api = fakeNeonApi([
      listing([{ id: "br-x", name: "preview/x", protected: true }]),
    ]);

    await expect(
      createBranch(
        { apiKey: "k", projectId: "p", fetch: api.fetch },
        {
          name: "preview/x",
          parent: "production",
          database: "neondb",
          ownerRole: "neondb_owner",
        },
      ),
    ).rejects.toThrow(/protégée ou par défaut/);
  });

  it("n'inclut jamais la réponse de l'API dans son message d'erreur", async () => {
    const api = fakeNeonApi([
      {
        method: "GET",
        path: /\/branches\?search=/,
        status: 500,
        body: { message: `hôte ${HOST}` },
      },
    ]);

    const error = await createBranch(
      { apiKey: "k", projectId: "p", fetch: api.fetch },
      {
        name: "preview/x",
        parent: "production",
        database: "neondb",
        ownerRole: "neondb_owner",
      },
    ).catch((e: Error) => e);

    expect(String(error)).toMatch(/HTTP 500/);
    expect(String(error)).not.toContain(HOST);
  });
});

describe("suppression d'une branche", () => {
  it("supprime la branche trouvée par son nom", async () => {
    const api = fakeNeonApi([
      listing([{ id: "br-ci", name: "ci/run-1-1" }]),
      { method: "DELETE", path: /\/branches\/br-ci$/, body: {} },
    ]);

    const deleted = await deleteBranch(
      { apiKey: "k", projectId: "p", fetch: api.fetch },
      "ci/run-1-1",
    );

    expect(deleted).toBe(true);
  });

  it("ne fait rien si la branche n'existe plus", async () => {
    const api = fakeNeonApi([listing([])]);

    const deleted = await deleteBranch(
      { apiKey: "k", projectId: "p", fetch: api.fetch },
      "ci/run-1-1",
    );

    expect(deleted).toBe(false);
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});

describe("commande create", () => {
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "neon-branch-"));
    const githubEnv = join(dir, "env");
    const githubOutput = join(dir, "output");
    const api = fakeNeonApi([
      {
        method: "GET",
        path: /\/branches\?search=production/,
        body: { branches: [{ id: "br-prod", name: "production" }] },
      },
      listing([]),
      {
        method: "POST",
        path: /\/branches$/,
        status: 201,
        body: { branch: { id: "br-new" } },
      },
      connectionUri,
    ]);
    const out: string[] = [];
    const env = {
      ...BASE_ENV,
      GITHUB_ENV: githubEnv,
      GITHUB_OUTPUT: githubOutput,
    };
    return { api, out, env, githubEnv, githubOutput };
  }

  it("masque hôtes, mots de passe et URL avant d'écrire les variables de la branche", async () => {
    const { api, out, env, githubEnv } = setup();

    await run(
      [
        "create",
        "ci/run-1-1",
        "--owner-env",
        "DATABASE_TEST_URL",
        "--app-env",
        "DATABASE_TEST_AUTHENTICATED_URL",
        "--ttl-hours",
        "2",
      ],
      env,
      { fetch: api.fetch, log: (line: string) => out.push(line) },
    );

    const masks = out
      .filter((l) => l.startsWith("::add-mask::"))
      .map((l) => l.slice(12));
    const written = readFileSync(githubEnv, "utf8");
    const appUrl = withRole(
      OWNER_URI,
      "app_backend",
      BASE_ENV.APP_BACKEND_PASSWORD,
    );
    expect(masks).toEqual(
      expect.arrayContaining([
        HOST,
        OWNER_URI,
        appUrl,
        "owner/pw",
        "owner%2Fpw",
      ]),
    );
    expect(written).toContain(`DATABASE_TEST_URL=${OWNER_URI}\n`);
    expect(written).toContain(`DATABASE_TEST_AUTHENTICATED_URL=${appUrl}\n`);
    // Rien d'autre que des masques ne cite l'hôte.
    expect(
      out.filter((l) => !l.startsWith("::add-mask::")).join("\n"),
    ).not.toContain(HOST);
  });

  it("publie l'identifiant de la branche en sortie de l'étape", async () => {
    const { api, out, env, githubOutput } = setup();

    await run(
      ["create", "ci/run-1-1", "--owner-env", "A", "--app-env", "B"],
      env,
      {
        fetch: api.fetch,
        log: (line: string) => out.push(line),
      },
    );

    expect(readFileSync(githubOutput, "utf8")).toContain("branch_id=br-new\n");
  });

  it("refuse de démarrer sans APP_BACKEND_PASSWORD", async () => {
    const { api, env } = setup();

    await expect(
      run(
        ["create", "ci/run-1-1", "--owner-env", "A", "--app-env", "B"],
        { ...env, APP_BACKEND_PASSWORD: "" },
        { fetch: api.fetch, log: () => {} },
      ),
    ).rejects.toThrow(/APP_BACKEND_PASSWORD/);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it("refuse de cibler une branche hors ci/ et preview/", async () => {
    const { api, env } = setup();

    await expect(
      run(["create", "production", "--owner-env", "A", "--app-env", "B"], env, {
        fetch: api.fetch,
        log: () => {},
      }),
    ).rejects.toThrow(/ci\/ ou preview\//);
    expect(api.fetch).not.toHaveBeenCalled();
  });
});
