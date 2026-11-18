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
  // Pas du job, du premier au dernier (« - » à l'indentation 6), commentaires retirés.
  const steps = migrate
    .slice(migrate.indexOf("    steps:\n") + "    steps:\n".length)
    .replace(/^ {6}#.*\n/gm, "")
    .split(/\n(?= {6}- )/);
  const statusContext = /-f context="Migrer la production"/;

  it("n'utilise plus l'action vercel/repository-dispatch (aucun code tiers pour le statut)", () => {
    expect(source).not.toContain("vercel/repository-dispatch");
  });

  it("le premier pas pose le commit status « Migrer la production » en attente sur github.sha, par gh api", () => {
    const first = steps[0] ?? "";

    expect(first).toContain("gh api");
    expect(first).toContain("/statuses/");
    expect(first).toContain("${{ github.sha }}");
    expect(first).toMatch(/state=pending/);
    expect(first).toMatch(statusContext);
  });

  it("le dernier pas pose success ou failure selon job.status, même après un échec ou une annulation", () => {
    const last = steps.at(-1) ?? "";

    expect(last).toMatch(/\n {8}if: always\(\)\n/);
    expect(last).toContain("gh api");
    expect(last).toContain("${{ github.sha }}");
    expect(last).toMatch(statusContext);
    // job.status passe par une variable d'environnement, jamais interpolé dans le script.
    expect(last).toMatch(/\n {10}JOB_STATUS: \$\{\{ job\.status \}\}\n/);
    const script = last.slice(
      last.indexOf("run:"),
      last.indexOf("\n        env:"),
    );
    expect(script).not.toContain("${{");
    expect(script).toMatch(/"\$JOB_STATUS" = "success"/);
    expect(script).toMatch(/state=success/);
    expect(script).toMatch(/state=failure/);
    expect(script).not.toMatch(/state=(?:error|pending)/);
  });

  it("les pas de statut n'ont que le GITHUB_TOKEN, et NODE_OPTIONS / BASH_ENV vidés", () => {
    for (const step of [steps[0] ?? "", steps.at(-1) ?? ""]) {
      expect(step).toMatch(/\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/);
      expect(step).toMatch(/\n {10}NODE_OPTIONS: ""/);
      expect(step).toMatch(/\n {10}BASH_ENV: ""/);
      expect(step).not.toContain("secrets.");
      expect(step).not.toContain("uses:");
    }
  });

  it("le job a contents: read et statuses: write, rien d'autre", () => {
    expect(migrate).toMatch(
      /\n {4}permissions:\n(?: {6}#.*\n)* {6}contents: read\n {6}statuses: write\n {4}\w/,
    );
    expect(migrate).not.toMatch(
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
