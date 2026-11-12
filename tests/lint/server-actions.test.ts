import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { findUnguardedActions } from "./unguarded-actions";

// Actions publiques (appelées sans session par construction), listées par nom : toute nouvelle action
// de ce fichier doit appeler requireSession ou être ajoutée ici, en revue.
const AUTH_ACTIONS_FILE = "src/lib/auth/actions.ts";
const PUBLIC_ACTIONS = [
  "signIn",
  "signOut",
  "requestPasswordReset",
  "resetPassword",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [relative(process.cwd(), path)]
      : [];
  });
}

function names(source: string, publicActions: string[] = []) {
  return findUnguardedActions(source, "probe.ts", publicActions).map(
    (found) => found.name,
  );
}

describe("garde des Server Actions : formes acceptées", () => {
  it("accepte await requireSession() en première instruction", () => {
    const source = `"use server";
export async function save() { await requireSession(); return 1; }`;

    expect(names(source)).toEqual([]);
  });

  it("accepte const … = await requireSession() en première instruction, et une flèche exportée", () => {
    const source = `"use server";
export const save = async () => { const { workspaceId } = await requireSession(); return workspaceId; };`;

    expect(names(source)).toEqual([]);
  });

  it("ignore les types exportés et les fonctions non exportées", () => {
    const source = `"use server";
export type State = { ok: boolean };
function helper() { return 1; }
export async function run() { await requireSession(); return helper(); }`;

    expect(names(source)).toEqual([]);
  });

  it("n'exige rien d'une action publique listée par nom", () => {
    const source = `"use server";
export async function signIn() { return 1; }`;

    expect(names(source, ["signIn"])).toEqual([]);
  });
});

describe("garde des Server Actions : contournements refusés", () => {
  it("refuse une fonction exportée sans requireSession", () => {
    const source = `"use server";
export async function save() { return 1; }`;

    expect(findUnguardedActions(source, "probe.ts")).toEqual([
      { file: "probe.ts", line: 2, name: "save" },
    ]);
  });

  it("refuse export { save } d'une fonction non gardée", () => {
    const source = `"use server";
async function save() { return 1; }
export { save as store };`;

    expect(names(source)).toEqual(["store"]);
  });

  it("refuse export default d'une fonction non gardée", () => {
    const source = `"use server";
export default async function () { return 1; }`;

    expect(names(source)).toEqual(["default"]);
  });

  it("refuse un export dont la valeur n'est pas une fonction écrite sur place (wrapper)", () => {
    const source = `"use server";
export const save = wrap(async () => { await requireSession(); });`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse export * et la ré-exportation depuis un autre module", () => {
    const source = `"use server";
export * from "./other";
export { save } from "./other";`;

    expect(names(source)).toEqual(["*", "save"]);
  });

  it("refuse void requireSession()", () => {
    const source = `"use server";
export async function save() { void requireSession(); return 1; }`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse un appel sans await", () => {
    const source = `"use server";
export async function save() { requireSession(); return 1; }`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse requireSession dans un try", () => {
    const source = `"use server";
export async function save() { try { await requireSession(); } catch {} return 1; }`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse un appel après un effet", () => {
    const source = `"use server";
export async function save(id: string) { await remove(id); await requireSession(); }`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse une flèche à corps expression", () => {
    const source = `"use server";
export const save = async () => requireSession();`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse une action en ligne (corps use server) non gardée dans un composant", () => {
    const source = `export function Page() {
  async function act() { "use server"; return 1; }
  return act;
}`;

    expect(findUnguardedActions(source, "page.tsx")).toEqual([
      { file: "page.tsx", line: 2, name: "act" },
    ]);
  });

  it("refuse une nouvelle action non listée dans src/lib/auth/actions.ts", () => {
    const source = `"use server";
export async function signIn() { return 1; }
export async function deleteAccount() { return 1; }`;

    expect(names(source, PUBLIC_ACTIONS)).toEqual(["deleteAccount"]);
  });
});

describe("garde des Server Actions : code de src/", () => {
  it("la liste des actions publiques correspond exactement aux actions de src/lib/auth/actions.ts", () => {
    const source = readFileSync(AUTH_ACTIONS_FILE, "utf8");

    const actions = findUnguardedActions(source, AUTH_ACTIONS_FILE).map(
      (found) => found.name,
    );

    expect(actions.sort()).toEqual([...PUBLIC_ACTIONS].sort());
  });

  it("toute Server Action de src/, hors actions publiques listées, appelle d'abord requireSession", () => {
    const files = sourceFiles("src");

    const found = files.flatMap((file) =>
      findUnguardedActions(
        readFileSync(file, "utf8"),
        file,
        file === AUTH_ACTIONS_FILE ? PUBLIC_ACTIONS : [],
      ),
    );

    expect(found).toEqual([]);
  });
});
