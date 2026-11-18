import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { findUnguardedRouteHandlers } from "./unguarded-actions";

// Le proxy laisse passer tout POST portant `next-action` sans session, sur tout chemin non public (QA-1,
// src/proxy.ts) : aucun gestionnaire de route de src/app ne peut compter sur lui. Chaque handler exporté
// appelle d'abord la garde de session, avec les mêmes règles que les Server Actions
// (tests/lint/server-actions.test.ts).
const APP_DIR = "src/app";
const ROUTE_FILE = /^route\.(c|m)?(j|t)sx?$/;

// Routes publiques (appelées sans session par construction), listées par chemin de fichier depuis la racine
// du dépôt. Vide aujourd'hui. Candidats futurs : route Vercel Cron (vérifie CRON_SECRET en première
// instruction), webhook (vérifie la signature avant tout). Chaque ajout est relu en revue.
const PUBLIC_ROUTES: string[] = [];

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return ROUTE_FILE.test(entry.name) ? [path] : [];
  });
}

/** Handlers non gardés de tous les route.* sous `root`/src/app, hors routes publiques listées. */
function unguardedRoutes(root: string, publicRoutes: readonly string[]) {
  return routeFiles(join(root, APP_DIR))
    .map((path) => relative(root, path))
    .filter((file) => !publicRoutes.includes(file))
    .flatMap((file) =>
      findUnguardedRouteHandlers(readFileSync(join(root, file), "utf8"), file),
    );
}

let fixture: string | undefined;

afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
  fixture = undefined;
});

/** Dépôt simulé : écrit chaque fichier sous un dossier temporaire et renvoie sa racine. */
function fakeRepo(files: Record<string, string>): string {
  fixture = mkdtempSync(join(tmpdir(), "route-handlers-"));
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(join(fixture, file, ".."), { recursive: true });
    writeFileSync(join(fixture, file), source);
  }
  return fixture;
}

const UNGUARDED_ROUTE = `export async function POST() { return Response.json({ ok: true }); }`;

function names(source: string) {
  return findUnguardedRouteHandlers(source, "route.ts").map(
    (found) => found.name,
  );
}

describe("garde des gestionnaires de route de src/app", () => {
  it("accepte un handler dont la première instruction est await requireSession()", () => {
    const source = `import { requireSession } from "@/lib/session";
export async function GET() { await requireSession(); return Response.json({}); }`;

    expect(names(source)).toEqual([]);
  });

  it("accepte const … = await requireSessionWithToken() dans une flèche exportée", () => {
    const source = `import { requireSessionWithToken } from "@/lib/session";
export const POST = async (request: Request) => { const { session } = await requireSessionWithToken(); return Response.json(session); };`;

    expect(names(source)).toEqual([]);
  });

  it("refuse un handler sans garde, même sans directive use server", () => {
    const source = `import { requireSession } from "@/lib/session";
export async function GET() { await requireSession(); return Response.json({}); }
export async function POST() { return Response.json({ ok: true }); }`;

    expect(names(source)).toEqual(["POST"]);
  });

  it("refuse une garde qui n'est pas la première instruction", () => {
    const source = `import { requireSession } from "@/lib/session";
export async function DELETE() { console.log("x"); await requireSession(); return new Response(null); }`;

    expect(names(source)).toEqual(["DELETE"]);
  });

  it("refuse un handler ré-exporté d'un autre module", () => {
    const source = `export { GET } from "./handlers";`;

    expect(names(source)).toEqual(["GET"]);
  });

  it("ignore les options de segment (dynamic, runtime…) et les types", () => {
    const source = `import { requireSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export type Body = { a: string };
export async function GET() { await requireSession(); return Response.json({}); }`;

    expect(names(source)).toEqual([]);
  });

  it("détecte un route.ts non gardé hors du groupe (app), par exemple sous src/app/api", () => {
    const root = fakeRepo({ "src/app/api/x/route.ts": UNGUARDED_ROUTE });

    const found = unguardedRoutes(root, []);

    expect(found).toEqual([
      {
        file: join("src", "app", "api", "x", "route.ts"),
        line: 1,
        name: "POST",
      },
    ]);
  });

  it("n'exige rien d'une route publique listée par chemin", () => {
    const root = fakeRepo({ "src/app/api/cron/route.ts": UNGUARDED_ROUTE });

    const found = unguardedRoutes(root, [
      join("src", "app", "api", "cron", "route.ts"),
    ]);

    expect(found).toEqual([]);
  });

  it("chaque route publique listée existe encore", () => {
    const missing = PUBLIC_ROUTES.filter(
      (file) =>
        !routeFiles(APP_DIR).some((path) => relative(".", path) === file),
    );

    expect(missing).toEqual([]);
  });

  it("tout route.ts de src/app, hors routes publiques listées, garde chacun de ses handlers", () => {
    const found = unguardedRoutes(process.cwd(), PUBLIC_ROUTES);

    expect(found).toEqual([]);
  });
});
