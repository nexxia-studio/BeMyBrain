// @vitest-environment node
// Verrous textuels sur les workflows de la CI (pas de parseur YAML : aucune dépendance ajoutée).
import { readFileSync } from "node:fs";
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

  it("le job Migrer la production pose le commit status Vercel par une action épinglée par SHA, avec actions: read et statuses: write", () => {
    const migrate = job(source, "migrate-production");
    const firstStep = migrate.slice(migrate.indexOf("    steps:\n"));

    expect(firstStep).toMatch(
      /^ {4}steps:\n(?: {6}#.*\n)* {6}- uses: vercel\/repository-dispatch\/actions\/status@30f760c6640485cd92f8c785ef361382555fb712 # v1\n {8}with:\n {10}name: Migrer la production\n/,
    );
    expect(migrate).toMatch(
      /\n {4}permissions:\n {6}contents: read\n {6}actions: read\n {6}statuses: write\n {4}\w/,
    );
    expect(migrate).not.toMatch(
      /contents: write|id-token|pull-requests|deployments|write-all/,
    );
  });

  it("le pas de statut Vercel n'utilise aucun secret, seulement le GITHUB_TOKEN par défaut", () => {
    const migrate = job(source, "migrate-production");
    const statusStep = migrate.slice(
      migrate.indexOf("- uses: vercel/repository-dispatch"),
      migrate.indexOf("- uses: actions/checkout"),
    );

    expect(statusStep).not.toContain("secrets.");
    expect(statusStep).not.toContain("token");
  });
});
