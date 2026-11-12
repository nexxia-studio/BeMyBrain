import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { findUnguardedActions, isScannedFile } from "./unguarded-actions";

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
    return isScannedFile(entry.name) ? [relative(process.cwd(), path)] : [];
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
import { requireSession } from "@/lib/session";
export async function save() { await requireSession(); return 1; }`;

    expect(names(source)).toEqual([]);
  });

  it("accepte const … = await requireSession() en première instruction, et une flèche exportée", () => {
    const source = `"use server";
import { requireSession } from "@/lib/session";
export const save = async () => { const { workspaceId } = await requireSession(); return workspaceId; };`;

    expect(names(source)).toEqual([]);
  });

  it("ignore les types exportés et les fonctions non exportées", () => {
    const source = `"use server";
import { requireSession } from "@/lib/session";
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

describe("garde des Server Actions : origine de requireSession", () => {
  const guarded = `export async function save() { await requireSession(); return 1; }`;

  it("refuse un fichier qui n'importe pas requireSession", () => {
    const source = `"use server";
${guarded}`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse un requireSession importé d'un autre module", () => {
    const source = `"use server";
import { requireSession } from "./fake-session";
${guarded}`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse un autre export renommé en requireSession", () => {
    const source = `"use server";
import { syncSessionLocale as requireSession } from "@/lib/session";
${guarded}`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse une déclaration locale de requireSession, même avec le bon import", () => {
    const source = `"use server";
import { requireSession as real } from "@/lib/session";
const requireSession = async () => ({});
${guarded}`;

    expect(names(source)).toEqual(["save"]);
  });

  it("refuse un paramètre qui masque requireSession", () => {
    const source = `"use server";
import { requireSession } from "@/lib/session";
export const make = () => {};
export async function save(requireSession: () => Promise<void>) { await requireSession(); }`;

    expect(names(source)).toEqual(["make", "save"]);
  });
});

describe("garde des Server Actions : exports mutables et fichiers parcourus", () => {
  it("refuse export let et export var, même gardés", () => {
    const source = `"use server";
import { requireSession } from "@/lib/session";
export let save = async () => { await requireSession(); };
export var remove = async () => { await requireSession(); };`;

    expect(names(source)).toEqual(["save", "remove"]);
  });

  it("parcourt aussi les .js, .jsx, .mjs, .cjs, .mts et .cts, pas les tests", () => {
    const files = ["a.ts", "b.tsx", "c.js", "d.jsx", "e.mjs", "f.cjs", "g.mts", "h.cts"];

    const scanned = [...files, "i.test.ts", "j.test.mjs", "k.json", "l.md"].filter(
      isScannedFile,
    );

    expect(scanned).toEqual(files);
  });

  it("repère une action non gardée dans un .mjs", () => {
    const source = `"use server";
export async function save() { return 1; }`;

    expect(findUnguardedActions(source, "probe.mjs")).toEqual([
      { file: "probe.mjs", line: 2, name: "save" },
    ]);
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
