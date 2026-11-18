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
  const pending = job(source, "status-pending");
  const migrate = job(source, "migrate-production");
  const final = job(source, "status-final");
  const statusContext = /-f context="Migrer la production"/;
  /** Permissions d'un job : bloc à l'indentation 4, commentaires compris, jusqu'à la clé suivante. */
  const permissions = (block: string) =>
    /\n {4}permissions:\n((?: {6}.*\n)+)/
      .exec(block)?.[1]
      ?.replace(/^ {6}#.*\n/gm, "");
  /** Script `run:` d'un job de statut, jusqu'à son bloc env. */
  const script = (block: string) =>
    block.slice(block.indexOf("run:"), block.indexOf("\n        env:"));

  it("trois jobs, dans l'ordre : statut en attente, migration, statut final", () => {
    const jobs = source.slice(source.indexOf("\njobs:\n"));
    const ids = [...jobs.matchAll(/^ {2}([\w-]+):\n/gm)].map((m) => m[1]);

    expect(ids).toEqual([
      "status-pending",
      "migrate-production",
      "status-final",
    ]);
  });

  it("n'utilise plus l'action vercel/repository-dispatch (aucun code tiers pour le statut)", () => {
    expect(source).not.toContain("vercel/repository-dispatch");
  });

  it("status-pending pose le commit status « Migrer la production » en attente sur github.sha, par gh api", () => {
    expect(pending).toContain("gh api");
    expect(pending).toContain("/statuses/");
    expect(pending).toMatch(/\n {10}SHA: \$\{\{ github\.sha \}\}\n/);
    expect(pending).toMatch(/state=pending/);
    expect(pending).toMatch(statusContext);
    expect(script(pending)).not.toContain("${{");
  });

  it("la migration attend status-pending, porte un nom affiché distinct du commit status et ne pose aucun statut", () => {
    expect(migrate).toMatch(/\n {4}needs: status-pending\n/);
    expect(migrate).toMatch(/\n {4}name: Migration production \(job\)\n/);
    expect(migrate).not.toMatch(/\n {4}name: Migrer la production\n/);
    expect(migrate).not.toContain("gh api");
    expect(migrate).not.toContain("/statuses/");
    expect(migrate).not.toContain("GH_TOKEN");
  });

  it("status-final tourne toujours et pose success seulement si la migration a réussi, sinon failure", () => {
    expect(final).toMatch(
      /\n {4}needs: \[status-pending, migrate-production\]\n/,
    );
    expect(final).toMatch(/\n {4}if: always\(\)\n/);
    expect(final).toContain("gh api");
    expect(final).toMatch(/\n {10}SHA: \$\{\{ github\.sha \}\}\n/);
    expect(final).toMatch(statusContext);
    // Le résultat passe par une variable d'environnement, jamais interpolé dans le script.
    expect(final).toMatch(
      /\n {10}MIGRATE_RESULT: \$\{\{ needs\.migrate-production\.result \}\}\n/,
    );
    const run = script(final);
    expect(run).not.toContain("${{");
    expect(run).toMatch(/"\$MIGRATE_RESULT" = "success"/);
    expect(run).toMatch(/state=success/);
    expect(run).toMatch(/state=failure/);
    expect(run).not.toMatch(/state=(?:error|pending)/);
  });

  it("les jobs de statut : statuses: write seul, GITHUB_TOKEN seul, ni checkout, ni install, ni secret, ni environnement", () => {
    for (const block of [pending, final]) {
      expect(permissions(block)).toBe("      statuses: write\n");
      expect(block).toMatch(/\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/);
      expect(block).toMatch(/\n {10}NODE_OPTIONS: ""/);
      expect(block).toMatch(/\n {10}BASH_ENV: ""/);
      expect(block).not.toMatch(/^\s*(?:- )?uses:/m);
      expect(block).not.toMatch(/checkout|pnpm|npm |setup-node/);
      expect(block).not.toContain("secrets.");
      expect(block).not.toMatch(/\n {4}environment:/);
    }
  });

  it("la migration seule porte l'environnement production, avec contents: read seul", () => {
    expect(migrate).toMatch(/\n {4}environment: production\n/);
    expect(permissions(migrate)).toBe("      contents: read\n");
    expect(source.match(/\n {4}environment:/g)).toHaveLength(1);
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

  it("statuses: write n'existe que dans le workflow de production", () => {
    const withStatuses = names.filter((name) =>
      /^\s*statuses:\s*write/m.test(workflow(name)),
    );

    expect(withStatuses).toEqual(["migrate-production.yml"]);
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
