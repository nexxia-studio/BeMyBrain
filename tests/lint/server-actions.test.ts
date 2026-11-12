import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { findUnguardedActions } from "./unguarded-actions";

// Actions publiques (appelées sans session par construction) : connexion, réinitialisation, déconnexion.
const PUBLIC_ACTION_FILES = ["src/lib/auth/actions.ts"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [relative(process.cwd(), path)]
      : [];
  });
}

describe("Server Actions non publiques", () => {
  it("signale une action exportée d'un fichier use server sans requireSession", () => {
    const source = `"use server";
export async function save(data: FormData) { return data; }
export const remove = async () => { await requireSession(); };`;

    const found = findUnguardedActions(source, "probe.ts");

    expect(found).toEqual([{ file: "probe.ts", line: 2, name: "save" }]);
  });

  it("signale une action en ligne (corps use server) sans requireSession", () => {
    const source = `export function Page() {
  async function act() { "use server"; return 1; }
  return act;
}`;

    const found = findUnguardedActions(source, "page.tsx");

    expect(found).toEqual([{ file: "page.tsx", line: 2, name: "act" }]);
  });

  it("ignore les fonctions non exportées d'un fichier use server et les fichiers ordinaires", () => {
    const source = `"use server";
function helper() { return 1; }
export async function run() { await requireSession(); return helper(); }`;

    const found = findUnguardedActions(source, "probe.ts");

    expect(found).toEqual([]);
  });

  it("toute Server Action de src/, hors auth publique, appelle requireSession", () => {
    const files = sourceFiles("src").filter(
      (file) => !PUBLIC_ACTION_FILES.includes(file),
    );

    const found = files.flatMap((file) =>
      findUnguardedActions(readFileSync(file, "utf8"), file),
    );

    expect(found).toEqual([]);
  });
});
