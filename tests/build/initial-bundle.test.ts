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
    // Le chargeur de l'import dynamique nomme les morceaux à télécharger par leur chemin.
    const source = readFileSync(join(NEXT_DIR, client[0] ?? ""), "utf8");
    const loaded = [
      ...new Set(source.match(/static\/chunks\/[\w.-]+\.js/g) ?? []),
    ];

    expect(loaded.filter(contains(SENTRY_FINGERPRINT))).not.toEqual([]);
  });

  it("témoin : gsap est bien dans un morceau chargé à la demande", () => {
    const chunks = readdirSync(join(NEXT_DIR, "static/chunks"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `static/chunks/${name}`);

    expect(chunks.some(containsGsap)).toBe(true);
  });
});
