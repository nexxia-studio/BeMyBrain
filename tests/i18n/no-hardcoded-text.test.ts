import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const TEXT_ATTRIBUTES = new Set(["aria-label", "title", "alt", "placeholder"]);

// Exceptions explicites, au format "chemin/relatif.tsx:ligne". Vide par principe (ADR-007).
const EXCEPTIONS: readonly string[] = [];

export type HardcodedText = { file: string; line: number; text: string };

function isLiteral(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

export function findHardcodedText(
  source: string,
  file: string,
): HardcodedText[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: HardcodedText[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    found.push({ file, line: line + 1, text });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).trim();
      if (text !== "") report(node, text);
    }
    if (
      ts.isJsxAttribute(node) &&
      TEXT_ATTRIBUTES.has(node.name.getText(sourceFile))
    ) {
      const init = node.initializer;
      const literal =
        init &&
        ts.isJsxExpression(init) &&
        init.expression &&
        isLiteral(init.expression)
          ? init.expression
          : init && ts.isStringLiteral(init)
            ? init
            : undefined;
      if (literal && literal.text.trim() !== "") report(literal, literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
}

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
