// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Lancé par `pnpm test:build`, après `next build` (ADR-006 : GSAP hors du bundle initial).
// Bundle initial d'une route = fichiers d'amorçage de l'app (build-manifest) + entrées JS de la page et
// de ses layouts (manifeste des références client de la route). Les moments signature, chargés par
// next/dynamic, vivent dans des morceaux à part.
const NEXT_DIR = join(process.cwd(), ".next");
const ROUTE = "/(app)/dashboard/page";
const ENTRY = "[project]/src/app/(app)/dashboard/page";
// Présent dans toute build de gsap (registre global de GreenSock), minifiée ou non.
const GSAP_FINGERPRINT = "GreenSockGlobals";
// Option de zod v4 lue par sa sonde `Function("")`, que la CSP de production refuse (violation eval).
const ZOD_FINGERPRINT = "jitless";

type BuildManifest = { rootMainFiles: string[]; polyfillFiles: string[] };
type ClientReferenceManifest = { entryJSFiles: Record<string, string[]> };

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(NEXT_DIR, file), "utf8")) as T;
}

function readClientReferenceManifest(): ClientReferenceManifest {
  const file = join(
    NEXT_DIR,
    "server/app/(app)/dashboard/page_client-reference-manifest.js",
  );
  const sandbox: { __RSC_MANIFEST?: Record<string, ClientReferenceManifest> } =
    {};
  new Function("globalThis", readFileSync(file, "utf8"))(sandbox);
  const manifest = sandbox.__RSC_MANIFEST?.[ROUTE];
  if (!manifest) throw new Error(`manifeste client de ${ROUTE} introuvable`);
  return manifest;
}

function contains(fingerprint: string) {
  return (file: string) =>
    readFileSync(join(NEXT_DIR, file), "utf8").includes(fingerprint);
}
const containsGsap = contains(GSAP_FINGERPRINT);

function initialFiles(): string[] {
  const build = readJson<BuildManifest>("build-manifest.json");
  const entries = readClientReferenceManifest().entryJSFiles[ENTRY] ?? [];
  if (entries.length === 0) throw new Error(`aucune entrée JS pour ${ENTRY}`);
  return [
    ...new Set([...build.polyfillFiles, ...build.rootMainFiles, ...entries]),
  ];
}

describe("bundle initial de /dashboard", () => {
  it("la build de production existe (pnpm test:build lance next build d'abord)", () => {
    expect(existsSync(join(NEXT_DIR, "BUILD_ID"))).toBe(true);
  });

  it("gsap n'est pas dans le bundle initial de /dashboard", () => {
    const initial = initialFiles();

    expect(initial.filter(containsGsap)).toEqual([]);
  });

  it("zod n'est pas dans le bundle initial de /dashboard (sa sonde eval viole la CSP)", () => {
    const initial = initialFiles();

    expect(initial.filter(contains(ZOD_FINGERPRINT))).toEqual([]);
  });

  it("témoin : gsap est bien dans un morceau chargé à la demande", () => {
    const chunks = readdirSync(join(NEXT_DIR, "static/chunks"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `static/chunks/${name}`);

    expect(chunks.some(containsGsap)).toBe(true);
  });
});
