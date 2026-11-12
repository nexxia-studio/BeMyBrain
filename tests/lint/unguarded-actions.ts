import ts from "typescript";

// Server Actions non publiques sans requireSession (règle frontend.md « Session », audit tâche 10).
// Une action = toute fonction exportée d'un fichier "use server", ou toute fonction dont le corps
// commence par "use server". Elle doit contenir un appel à requireSession().

export type UnguardedAction = { file: string; line: number; name: string };

function hasUseServer(statements: readonly ts.Statement[]): boolean {
  for (const statement of statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    )
      return false;
    if (statement.expression.text === "use server") return true;
  }
  return false;
}

function callsRequireSession(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node) => {
    if (found) return;
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === "requireSession"
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

function isFunctionLike(node: ts.Node): node is FunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function isExported(node: ts.Node): boolean {
  const target = ts.isVariableDeclaration(node)
    ? node.parent.parent
    : node;
  return (
    ts.canHaveModifiers(target) &&
    (ts.getModifiers(target) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    )
  );
}

export function findUnguardedActions(
  source: string,
  file: string,
): UnguardedAction[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const fileIsActions = hasUseServer(sourceFile.statements);
  const found: UnguardedAction[] = [];

  const report = (fn: FunctionLike, name: string) => {
    if (callsRequireSession(fn)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(fn.getStart());
    found.push({ file, line: line + 1, name });
  };

  const visit = (node: ts.Node) => {
    if (isFunctionLike(node)) {
      const body = node.body;
      const inline =
        body !== undefined && ts.isBlock(body) && hasUseServer(body.statements);
      const exported =
        fileIsActions &&
        (isExported(node) ||
          (ts.isVariableDeclaration(node.parent) && isExported(node.parent)));
      if (inline || exported) {
        const name =
          node.name?.getText(sourceFile) ??
          (ts.isVariableDeclaration(node.parent)
            ? node.parent.name.getText(sourceFile)
            : "(anonyme)");
        report(node, name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}
