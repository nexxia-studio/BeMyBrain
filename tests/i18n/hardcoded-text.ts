import ts from "typescript";

const TEXT_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "title",
  "alt",
  "placeholder",
  "label",
]);

export type HardcodedText = { file: string; line: number; text: string };

// Texte fixe d'un littéral chaîne ou d'un gabarit (parties hors ${}), sinon undefined.
function fixedText(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]
      .join(" ")
      .replace(/\s+/g, " ");
  }
  return undefined;
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
      const value = init && ts.isJsxExpression(init) ? init.expression : init;
      const text = fixedText(value)?.trim();
      if (value && text) report(value, text);
    }
    if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      const text = fixedText(node.expression)?.trim();
      if (node.expression && text) report(node.expression, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
}
