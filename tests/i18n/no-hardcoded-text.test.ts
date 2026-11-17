import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { findHardcodedText } from "./hardcoded-text";

// Exceptions explicites, au format "chemin/relatif.tsx:ligne". Vide par principe (ADR-007).
const EXCEPTIONS: readonly string[] = [];

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
      ? [path]
      : [];
  });
}

describe("aucun texte d'interface en dur", () => {
  it("échoue sur un composant de test contenant un texte en dur", () => {
    const source = `export function Hello() { return <p>Bonjour</p>; }`;

    const found = findHardcodedText(source, "Hello.tsx");

    expect(found).toEqual([{ file: "Hello.tsx", line: 1, text: "Bonjour" }]);
  });

  it("accepte un composant qui n'utilise que t()", () => {
    const source = `export function Hello({ t }: { t: (k: string) => string }) {
  return (
    <button aria-label={t("app.close")} title={t("app.close")}>
      {t("app.name")}
    </button>
  );
}`;

    const found = findHardcodedText(source, "Hello.tsx");

    expect(found).toEqual([]);
  });

  it("signale un aria-label littéral", () => {
    const source = `export function Close() {
  return <button aria-label="Fermer" title={\`Fermer\`} />;
}`;

    const found = findHardcodedText(source, "Close.tsx");

    expect(found).toEqual([
      { file: "Close.tsx", line: 2, text: "Fermer" },
      { file: "Close.tsx", line: 2, text: "Fermer" },
    ]);
  });

  it("signale un littéral entre accolades en enfant JSX", () => {
    const source = `export function Hello({ name }: { name: string }) {
  return (
    <p>
      {"Bonjour"}
      <>{\`Bonjour \${name}\`}</>
    </p>
  );
}`;

    const found = findHardcodedText(source, "Hello.tsx");

    expect(found).toEqual([
      { file: "Hello.tsx", line: 4, text: "Bonjour" },
      { file: "Hello.tsx", line: 5, text: "Bonjour" },
    ]);
  });

  it('ignore {" "} entre deux expressions', () => {
    const source = `export function Hello({ t }: { t: (k: string) => string }) {
  return <p>{t("a")}{" "}{\` \`}{t("b")}</p>;
}`;

    const found = findHardcodedText(source, "Hello.tsx");

    expect(found).toEqual([]);
  });

  it("signale un attribut label littéral", () => {
    const source = `export function Option() {
  return <option label="Français" aria-valuetext="trois" />;
}`;

    const found = findHardcodedText(source, "Option.tsx");

    expect(found).toEqual([
      { file: "Option.tsx", line: 2, text: "Français" },
      { file: "Option.tsx", line: 2, text: "trois" },
    ]);
  });

  it("aucun fichier de src/ ne contient de texte en dur", () => {
    const root = process.cwd();
    const files = listTsxFiles(join(root, "src"));

    const found = files
      .flatMap((path) =>
        findHardcodedText(readFileSync(path, "utf8"), relative(root, path)),
      )
      .filter(({ file, line }) => !EXCEPTIONS.includes(`${file}:${line}`))
      .map(({ file, line, text }) => `${file}:${line} ${text}`);

    expect(files.length).toBeGreaterThan(0);
    expect(found).toEqual([]);
  });
});
