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
// Porte globale du SDK Sentry (@sentry/core), présente dans tout morceau qui embarque le SDK navigateur.
// Chargé à la demande par src/lib/sentry-client.ts, seulement si Sentry est actif.
const SENTRY_FINGERPRINT = "__SENTRY__";
// Message console de src/lib/sentry-client.ts : repère le morceau qui porte loadSentry et son chargeur.
const SENTRY_CLIENT_FINGERPRINT = "Sentry indisponible, erreur non envoyée";

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

// Le chargeur d'un import dynamique nomme les morceaux à télécharger par leur chemin.
const CHUNK_PATH = /static\/chunks\/[\w.-]+\.js/g;
// Appel d'un module chargé à la demande par Turbopack (`e.A(31427)`), dont la définition peut vivre dans un
// autre petit morceau (constaté le 2026-11-18 : le chargeur sorti de sentry-client dans un morceau de 214 octets).
const ASYNC_MODULE_CALL = /\.A\((\d+)\)/g;
// Niveaux d'indirection suivis depuis sentry-client (un suffit aujourd'hui).
const MAX_LOADER_DEPTH = 3;

function readChunk(file: string): string {
  return readFileSync(join(NEXT_DIR, file), "utf8");
}

/** Morceaux qui définissent le module `id` : entrée `,<id>,<fabrique>` du tableau poussé dans TURBOPACK. */
function chunksDefining(id: string, chunks: string[]): string[] {
  const definition = new RegExp(`[,[]${id},(?:\\(|[\\w$]+=>|function)`);
  return chunks.filter((file) => definition.test(readChunk(file)));
}

/**
 * Chemins de morceaux que sentry-client fait télécharger : ceux nommés dans son morceau, et ceux nommés dans
 * les morceaux qui définissent les modules qu'il appelle par `.A(<id>)` (jusqu'à MAX_LOADER_DEPTH niveaux).
 */
function chunksLoadedFrom(start: string, chunks: string[]): string[] {
  const loaded = new Set<string>();
  const seenIds = new Set<string>();
  let loaders = [start];
  for (
    let depth = 0;
    depth <= MAX_LOADER_DEPTH && loaders.length > 0;
    depth++
  ) {
    const next: string[] = [];
    for (const loader of loaders) {
      const source = readChunk(loader);
      for (const path of source.match(CHUNK_PATH) ?? []) loaded.add(path);
      for (const [, id] of source.matchAll(ASYNC_MODULE_CALL)) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        next.push(...chunksDefining(id, chunks));
      }
    }
    loaders = next;
  }
  return [...loaded];
}

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

  it("le SDK Sentry n'est pas dans le bundle initial de /dashboard (chargement différé)", () => {
    const initial = initialFiles();

    expect(initial.filter(contains(SENTRY_FINGERPRINT))).toEqual([]);
  });

  it("témoin : le SDK Sentry est dans un morceau chargé à la demande par sentry-client", () => {
    const chunks = readdirSync(join(NEXT_DIR, "static/chunks"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `static/chunks/${name}`);
    const client = chunks.filter(contains(SENTRY_CLIENT_FINGERPRINT));
    expect(client, "morceau de sentry-client introuvable").toHaveLength(1);
    const loaded = chunksLoadedFrom(client[0] ?? "", chunks);

    expect(loaded, "aucun morceau chargé par sentry-client").not.toEqual([]);
    expect(loaded.filter(contains(SENTRY_FINGERPRINT))).not.toEqual([]);
  });

  it("témoin : gsap est bien dans un morceau chargé à la demande", () => {
    const chunks = readdirSync(join(NEXT_DIR, "static/chunks"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `static/chunks/${name}`);

    expect(chunks.some(containsGsap)).toBe(true);
  });
});
