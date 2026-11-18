import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { findUnguardedRouteHandlers } from "./unguarded-actions";

// Le proxy laisse passer tout POST portant `next-action` (QA-1, src/proxy.ts) : un gestionnaire de route
// de (app) ne peut pas compter sur lui. Chaque handler exporté appelle d'abord la garde de session, avec les
// mêmes règles que les Server Actions (tests/lint/server-actions.test.ts).
const APP_GROUP = "src/app/(app)";
const ROUTE_FILE = /^route\.(c|m)?(j|t)sx?$/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return ROUTE_FILE.test(entry.name) ? [relative(process.cwd(), path)] : [];
  });
}

function names(source: string) {
  return findUnguardedRouteHandlers(source, "route.ts").map(
    (found) => found.name,
  );
}

describe("garde des gestionnaires de route de (app)", () => {
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

  it("tout route.ts de src/app/(app) garde chacun de ses handlers", () => {
    const files = routeFiles(APP_GROUP);

    const found = files.flatMap((file) =>
      findUnguardedRouteHandlers(readFileSync(file, "utf8"), file),
    );

    expect(found).toEqual([]);
  });
});
