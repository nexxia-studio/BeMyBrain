// @vitest-environment node
// Verrous textuels sur les workflows de la CI (pas de parseur YAML : aucune dépendance ajoutée).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = (name: string) =>
  readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");

/** Bloc d'un job : de sa clé (indentation 2) jusqu'au job suivant. */
function job(source: string, id: string) {
  const start = source.indexOf(`\n  ${id}:\n`);
  if (start === -1) throw new Error(`job ${id} introuvable`);
  const rest = source.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe("workflow CI", () => {
  it("nomme la branche Neon du run sans le numéro d'essai, pour qu'un job relancé vise la même", () => {
    const ci = workflow("ci.yml");

    expect(ci).toMatch(/CI_BRANCH: ci\/run-\$\{\{ github\.run_id \}\}\n/);
    expect(ci).not.toContain("github.run_attempt");
  });
});

describe("workflow des previews", () => {
  const source = workflow("preview-database.yml");

  it("migre sans publier l'URL app_backend, inutile à la migration", () => {
    const migrate = job(source, "migrate-preview");

    expect(migrate).toContain("--owner-env DATABASE_URL");
    expect(migrate).not.toContain("--app-env");
  });

  it("nettoie aussi après un échec de publication, pas seulement de migration", () => {
    const cleanup = job(source, "delete-preview");

    expect(cleanup).toMatch(/needs: \[migrate-preview, publish-preview\]/);
    expect(cleanup).toContain("needs.migrate-preview.result == 'failure'");
    expect(cleanup).toContain("needs.publish-preview.result == 'failure'");
    expect(cleanup).toContain("github.event.action == 'closed'");
    expect(cleanup).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(cleanup).toContain(
      "github.head_ref != github.event.repository.default_branch",
    );
  });
});

describe("workflow de production", () => {
  const source = workflow("migrate-production.yml");
  const migrate = job(source, "migrate-production");
  const deploy = job(source, "deploy-production");
  /** Permissions d'un job : bloc à l'indentation 4, commentaires compris, jusqu'à la clé suivante. */
  const permissions = (block: string) =>
    /\n {4}permissions:\n((?: {6}.*\n)+)/
      .exec(block)?.[1]
      ?.replace(/^ {6}#.*\n/gm, "");

  it("deux jobs, dans l'ordre : migration puis déploiement", () => {
    const jobs = source.slice(source.indexOf("\njobs:\n"));
    const ids = [...jobs.matchAll(/^ {2}([\w-]+):\n/gm)].map((m) => m[1]);

    expect(ids).toEqual(["migrate-production", "deploy-production"]);
  });

  it("n'utilise plus l'action vercel/repository-dispatch ni aucun commit status", () => {
    expect(source).not.toContain("vercel/repository-dispatch");
    expect(source).not.toContain("gh api");
    expect(source).not.toContain("/statuses/");
    expect(source).not.toContain("Migrer la production");
  });

  it("se déclenche seulement au push sur main", () => {
    const head = source.slice(source.indexOf("\non:\n"));
    const trigger = head.slice(0, head.indexOf("\n\n", 1));

    expect(trigger).toBe("\non:\n  push:\n    branches: [main]");
    expect(source).not.toMatch(
      /workflow_dispatch|pull_request_target|workflow_run|pull_request:/,
    );
  });

  it("la migration n'attend rien, porte un nom affiché propre et ne pose aucun statut", () => {
    expect(migrate).not.toMatch(/\n {4}needs:/);
    expect(migrate).toMatch(/\n {4}name: Migration production \(job\)\n/);
    expect(migrate).not.toContain("GH_TOKEN");
  });

  it("la migration et le déploiement portent seuls l'environnement production, avec contents: read seul", () => {
    expect(migrate).toMatch(/\n {4}environment: production\n/);
    expect(deploy).toMatch(/\n {4}environment: production\n/);
    expect(permissions(migrate)).toBe("      contents: read\n");
    expect(permissions(deploy)).toBe("      contents: read\n");
    expect(source.match(/\n {4}environment:/g)).toHaveLength(2);
  });

  it("deploy-production attend migrate-production, sans always() ni continue-on-error", () => {
    expect(deploy).toMatch(/\n {4}needs: migrate-production\n/);
    expect(deploy).toMatch(/\n {4}name: Déploiement production\n/);
    expect(deploy).toMatch(/\n {4}timeout-minutes: 30\n/);
    expect(deploy).not.toContain("always()");
    expect(deploy).not.toContain("continue-on-error");
    expect(deploy).not.toMatch(/\n {4}if:/);
  });

  it("deploy-production lance le script avec toutes les variables qu'il lit, sans installation", () => {
    expect(deploy).toContain("node scripts/ci/vercel-production-deploy.mjs");
    // GITHUB_REPOSITORY et GITHUB_STEP_SUMMARY viennent du runner : aucun `env:` ne les surcharge.
    expect(deploy).not.toMatch(/GITHUB_REPOSITORY:|GITHUB_STEP_SUMMARY/);
    for (const line of [
      "VERCEL_TOKEN: ${{ secrets.VERCEL_PRODUCTION_TOKEN }}",
      "VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}",
      "VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}",
      "SHA: ${{ github.sha }}",
      "GITHUB_REPOSITORY_ID: ${{ github.repository_id }}",
      "GH_TOKEN: ${{ github.token }}",
      "DEFAULT_GIT_BRANCH: ${{ github.event.repository.default_branch }}",
      'NODE_OPTIONS: ""',
      'BASH_ENV: ""',
    ]) {
      expect(deploy).toContain(line);
    }
    expect(deploy).not.toMatch(/pnpm|npm |npx|corepack|cache:/);
  });

  it("deploy-production : jeton Vercel dans l'env de l'étape seule, aucun env au niveau du job, aucun jeton persisté", () => {
    const step = deploy.slice(deploy.indexOf("- name: Déployer la production"));

    expect(step).toContain(
      "VERCEL_TOKEN: ${{ secrets.VERCEL_PRODUCTION_TOKEN }}",
    );
    expect(deploy).not.toMatch(/\n {4}env:/);
    expect(deploy).toMatch(
      /actions\/checkout@[0-9a-f]{40} # v[\d.]+\n {8}with:\n {10}persist-credentials: false\n/,
    );
  });

  it("VERCEL_PRODUCTION_TOKEN n'apparaît que dans deploy-production, jamais VERCEL_TOKEN en secret", () => {
    expect(source.match(/secrets\.VERCEL_PRODUCTION_TOKEN/g)).toHaveLength(1);
    expect(deploy).toContain("secrets.VERCEL_PRODUCTION_TOKEN");
    expect(source).not.toContain("secrets.VERCEL_TOKEN");
    expect(source).not.toMatch(/secrets\[\s*['"]VERCEL_/);
  });

  it("DATABASE_URL et SEED_OWNER_USER_ID n'apparaissent que dans migrate-production", () => {
    expect(deploy).not.toMatch(/DATABASE_URL|SEED_OWNER_USER_ID/);
    expect(migrate).toContain("secrets.DATABASE_URL");
  });

  it("le groupe de concurrence reste migrate-production, sans annulation", () => {
    expect(source).toMatch(
      /\nconcurrency:\n(?: {2}#.*\n)* {2}group: migrate-production\n {2}cancel-in-progress: false\n/,
    );
  });

  it("le seed lit l'id du propriétaire dans un secret, masqué dans le journal", () => {
    const seedEnv = migrate.slice(migrate.indexOf("name: Seed"));

    expect(seedEnv).toContain(
      "SEED_OWNER_USER_ID: ${{ secrets.SEED_OWNER_USER_ID }}",
    );
  });

  it("aucune permission large dans le workflow", () => {
    expect(source).not.toMatch(
      /actions: read|contents: write|id-token|pull-requests|deployments|write-all/,
    );
  });
});

describe("tous les workflows", () => {
  const names = readdirSync(join(process.cwd(), ".github/workflows")).filter(
    (name) => /\.ya?ml$/.test(name),
  );

  it("statuses: write n'existe dans aucun workflow", () => {
    const withStatuses = names.filter((name) =>
      /^\s*statuses:\s*write/m.test(workflow(name)),
    );

    expect(withStatuses).toEqual([]);
  });

  it("aucun workflow n'a write-all ni de permission statuses, sous aucune forme", () => {
    const wide = names.filter((name) => {
      const text = workflow(name);
      return /write-all/.test(text) || /^\s*permissions:.*statuses/m.test(text);
    });

    expect(wide).toEqual([]);
  });

  it("aucun workflow ne pose de commit status (gh api, /statuses/)", () => {
    const withStatusCalls = names.filter((name) =>
      /gh api[^\n]*statuses|\/statuses\//.test(workflow(name)),
    );

    expect(withStatusCalls).toEqual([]);
  });

  it("ne lit en vars.* que des noms Neon anodins : une variable n'est jamais masquée dans les journaux", () => {
    const anodyne = [
      "NEON_CI_PARENT_BRANCH",
      "NEON_DATABASE",
      "NEON_OWNER_ROLE",
    ];

    const used = names.flatMap((name) =>
      [...workflow(name).matchAll(/\bvars\.(\w+)/g)].map((match) => match[1]),
    );

    expect(used.filter((name) => !anodyne.includes(name ?? ""))).toEqual([]);
  });

  it("toute action tierce est épinglée par SHA de commit complet", () => {
    for (const name of names) {
      const uses = [
        ...workflow(name).matchAll(/^\s*(?:- )?uses:\s*(\S+)/gm),
      ].map((match) => match[1] ?? "");
      for (const ref of uses.filter((ref) => !ref.startsWith("./"))) {
        expect(ref, `${name} : ${ref}`).toMatch(
          /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/,
        );
      }
    }
  });
});
