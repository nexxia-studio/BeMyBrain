// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import enErrors from "../../messages/errors/en.json";
import fr from "../../messages/fr.json";
import frErrors from "../../messages/errors/fr.json";

// Lancé par `pnpm test:build`, après `next build`. global-error n'a pas de NextIntlClientProvider : elle
// importe ses textes elle-même. Turbopack n'élague pas un JSON (import nommé compris, vérifié le
// 2026-11-18) : seuls les fichiers de la section errors doivent entrer dans ses morceaux.
const NEXT_DIR = join(process.cwd(), ".next");
const ROUTE = "/_global-error/page";
const ENTRY = "[project]/src/app/global-error";

type ClientReferenceManifest = { entryJSFiles: Record<string, string[]> };

function entryChunks(): string[] {
  const file = join(
    NEXT_DIR,
    "server/app/_global-error/page_client-reference-manifest.js",
  );
  const sandbox: { __RSC_MANIFEST?: Record<string, ClientReferenceManifest> } =
    {};
  new Function("globalThis", readFileSync(file, "utf8"))(sandbox);
  const files = sandbox.__RSC_MANIFEST?.[ROUTE]?.entryJSFiles[ENTRY] ?? [];
  if (files.length === 0) throw new Error(`aucune entrée JS pour ${ENTRY}`);
  return files.map((name) => readFileSync(join(NEXT_DIR, name), "utf8"));
}

describe("morceaux de global-error", () => {
  it("contiennent les textes de la section errors (témoin)", () => {
    const code = entryChunks().join("\n");

    expect(code).toContain(frErrors.title);
    expect(code).toContain(enErrors.title);
  });

  it("ne contiennent aucun autre texte des fichiers de messages", () => {
    const code = entryChunks().join("\n");

    for (const text of [
      fr.app.description,
      en.app.description,
      fr.auth.login.forgotPassword,
      en.auth.login.forgotPassword,
    ]) {
      expect(code).not.toContain(text);
    }
  });
});
