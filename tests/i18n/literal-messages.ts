import ts from "typescript";

// Garde « toast et erreurs ne reçoivent que t(...) » (plan socle, Décisions, « Textes hors JSX ») : complète
// hardcoded-text.ts, qui ne voit que le texte JSX direct. Signale un littéral de texte passé à un toast, renvoyé
// dans un champ `error` / `message`, passé à un setter d'erreur ou de message, affiché par une condition
// dans le JSX, et l'affichage brut de `error.message`.
// Une clé de message (camelCase, segments séparés par des points : `invalidCredentials`, `errors.retry`) est
// acceptée : elle est traduite par le composant.
// raccourci: un mot seul en minuscules ASCII (« erreur ») passe pour une clé — à durcir en vérifiant les clés
// contre messages/*.json si un tel faux négatif apparaît.

export type LiteralMessage = { file: string; line: number; text: string };

const KEY = /^[a-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;
const KEY_PART = /^[A-Za-z0-9_.]*$/;
const LETTER = /\p{L}/u;
const MESSAGE_PROPERTIES = new Set(["error", "message"]);
const MESSAGE_SETTER = /^set\w*(Error|Message|Toast|Notice)\w*$/;

type Found = { node: ts.Node; text: string };

/** Littéraux de texte que peut valoir une expression (branches de ?:, &&, ||, ??), clés exclues. */
function literalTexts(node: ts.Expression | undefined): Found[] {
  if (!node) return [];
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return literalTexts(node.expression);
  }
  if (ts.isConditionalExpression(node)) {
    return [...literalTexts(node.whenTrue), ...literalTexts(node.whenFalse)];
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      return literalTexts(node.right);
    }
    if (
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return [...literalTexts(node.left), ...literalTexts(node.right)];
    }
    return [];
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const text = node.text.trim();
    return LETTER.test(text) && !KEY.test(text) ? [{ node, text }] : [];
  }
  if (ts.isTemplateExpression(node)) {
    const parts = [
      node.head.text,
      ...node.templateSpans.map((s) => s.literal.text),
    ];
    if (parts.every((part) => KEY_PART.test(part))) return [];
    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    return LETTER.test(text) ? [{ node, text }] : [];
  }
  return [];
}

/** Argument d'un toast : texte direct, ou champs d'un objet d'options (`description`, `title`…). */
function toastArgumentTexts(node: ts.Expression): Found[] {
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.flatMap((property) =>
      ts.isPropertyAssignment(property)
        ? literalTexts(property.initializer)
        : [],
    );
  }
  return literalTexts(node);
}

function isToastCall(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return callee.text === "toast";
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === "toast"
  );
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name)
    ? name.text
    : undefined;
}

export function isServerActionFile(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "directive.ts",
    source,
    ts.ScriptTarget.Latest,
  );
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false;
    }
    if (statement.expression.text === "use server") return true;
  }
  return false;
}

export function findLiteralMessages(
  source: string,
  file: string,
): LiteralMessage[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX,
  );
  const found = new Map<number, LiteralMessage>();
  const report = ({ node, text }: Found) => {
    const start = node.getStart(sourceFile);
    const { line } = sourceFile.getLineAndCharacterOfPosition(start);
    found.set(start, { file, line: line + 1, text });
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (isToastCall(node.expression)) {
        node.arguments.flatMap(toastArgumentTexts).forEach(report);
      } else if (
        ts.isIdentifier(node.expression) &&
        MESSAGE_SETTER.test(node.expression.text)
      ) {
        node.arguments.flatMap((arg) => literalTexts(arg)).forEach(report);
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      MESSAGE_PROPERTIES.has(propertyName(node.name) ?? "")
    ) {
      literalTexts(node.initializer).forEach(report);
    }
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      const expression = node.expression;
      // Un littéral direct ({"Bonjour"}) est déjà signalé par hardcoded-text.ts.
      if (
        ts.isConditionalExpression(expression) ||
        ts.isBinaryExpression(expression) ||
        ts.isParenthesizedExpression(expression)
      ) {
        literalTexts(expression).forEach(report);
      }
      if (
        ts.isPropertyAccessExpression(expression) &&
        expression.name.text === "message"
      ) {
        report({ node: expression, text: expression.getText(sourceFile) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...found.values()].sort((a, b) => a.line - b.line);
}
