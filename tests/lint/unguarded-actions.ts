import ts from "typescript";

// Server Actions non gardées (règle frontend.md « Session », audit tâche 10).
// Action = toute valeur exportée d'un fichier "use server" (export function, export const, export default,
// export { x }, export * / from), ou toute fonction dont le corps commence par "use server".
// Gardée = `requireSession` est l'import de @/lib/session (aucune autre déclaration de ce nom) et la première instruction du corps (après les directives) est `await requireSession();` ou
// `const … = await requireSession();`. Un export qui n'est pas une fonction écrite sur place (wrapper,
// ré-export) est refusé : la garde ne peut pas y être lue.

export type UnguardedAction = { file: string; line: number; name: string };

const SESSION_MODULE = "@/lib/session";
const GUARD = "requireSession";

/** Fichiers source parcourus (JS et TS, toutes variantes), hors tests. */
export function isScannedFile(name: string): boolean {
  return /\.(c|m)?(j|t)sx?$/.test(name) && !/\.test\.(c|m)?(j|t)sx?$/.test(name);
}

/**
 * Vrai si `requireSession` désigne sans ambiguïté celui de @/lib/session : importé de ce module sous son
 * propre nom, et aucune autre déclaration de ce nom dans le fichier (variable, fonction, paramètre…).
 */
function trustsGuard(sourceFile: ts.SourceFile): boolean {
  let trustedImports = 0;
  let otherDeclarations = 0;
  const visit = (node: ts.Node) => {
    if (ts.isImportSpecifier(node) && node.name.text === GUARD) {
      const declaration = node.parent.parent.parent;
      const fromSession =
        ts.isStringLiteral(declaration.moduleSpecifier) &&
        declaration.moduleSpecifier.text === SESSION_MODULE;
      const sameName = (node.propertyName ?? node.name).getText(sourceFile) === GUARD;
      const typeOnly = node.isTypeOnly || node.parent.parent.isTypeOnly;
      if (fromSession && sameName && !typeOnly) trustedImports += 1;
      else otherDeclarations += 1;
    } else if (
      (ts.isImportClause(node) ||
        ts.isNamespaceImport(node) ||
        ts.isImportEqualsDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isBindingElement(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name) &&
      node.name.text === GUARD
    ) {
      otherDeclarations += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return trustedImports === 1 && otherDeclarations === 0;
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

/** Directives en tête de liste (prologue) et première vraie instruction. */
function prologue(statements: readonly ts.Statement[]) {
  const directives: string[] = [];
  let index = 0;
  for (const statement of statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    )
      break;
    directives.push(statement.expression.text);
    index += 1;
  }
  return { directives, firstStatement: statements[index] };
}

function isAwaitRequireSession(node: ts.Expression | undefined): boolean {
  return (
    node !== undefined &&
    ts.isAwaitExpression(node) &&
    ts.isCallExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "requireSession"
  );
}

function isGuarded(fn: FunctionLike): boolean {
  if (!fn.body || !ts.isBlock(fn.body)) return false;
  const first = prologue(fn.body.statements).firstStatement;
  if (!first) return false;
  if (ts.isExpressionStatement(first))
    return isAwaitRequireSession(first.expression);
  if (ts.isVariableStatement(first)) {
    const [declaration, ...rest] = first.declarationList.declarations;
    return rest.length === 0 && isAwaitRequireSession(declaration.initializer);
  }
  return false;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === kind)
  );
}

function asFunction(node: ts.Expression | undefined): FunctionLike | undefined {
  if (!node) return undefined;
  const inner = ts.isParenthesizedExpression(node) ? node.expression : node;
  return ts.isArrowFunction(inner) || ts.isFunctionExpression(inner)
    ? inner
    : undefined;
}

/** Valeurs déclarées au niveau du module, par nom local : la fonction écrite sur place, sinon null. */
function localValues(sourceFile: ts.SourceFile) {
  const map = new Map<string, FunctionLike | null>();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name)
      map.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name))
          map.set(
            declaration.name.text,
            asFunction(declaration.initializer) ?? null,
          );
      }
    }
  }
  return map;
}

export function findUnguardedActions(
  source: string,
  file: string,
  publicActions: readonly string[] = [],
): UnguardedAction[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.(c|m)?jsx?$/.test(file)
      ? ts.ScriptKind.JSX
      : file.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
  );
  const found: UnguardedAction[] = [];
  const guardTrusted = trustsGuard(sourceFile);
  // Fonctions déjà jugées comme exports (ne pas les rejuger comme actions en ligne).
  const judged = new Set<ts.Node>();

  const refuse = (node: ts.Node, name: string) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    found.push({ file, line: line + 1, name });
  };
  const check = (
    name: string,
    node: ts.Node,
    fn: FunctionLike | null | undefined,
  ) => {
    if (fn) judged.add(fn);
    if (publicActions.includes(name)) return;
    if (!fn || !guardTrusted || !isGuarded(fn)) refuse(fn ?? node, name);
  };

  if (prologue(sourceFile.statements).directives.includes("use server")) {
    const locals = localValues(sourceFile);
    for (const statement of sourceFile.statements) {
      const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
      if (ts.isFunctionDeclaration(statement) && exported) {
        const name = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
          ? "default"
          : (statement.name?.text ?? "default");
        check(name, statement, statement);
      } else if (ts.isVariableStatement(statement) && exported) {
        // export let / var : la valeur peut être remplacée après coup, la garde n'est plus lisible.
        const mutable = !(
          statement.declarationList.flags & ts.NodeFlags.Const
        );
        for (const declaration of statement.declarationList.declarations) {
          if (mutable) {
            refuse(declaration, declaration.name.getText(sourceFile));
            continue;
          }
          check(
            declaration.name.getText(sourceFile),
            declaration,
            asFunction(declaration.initializer),
          );
        }
      } else if (ts.isExportAssignment(statement)) {
        const expression = statement.expression;
        const fn = ts.isIdentifier(expression)
          ? locals.get(expression.text)
          : asFunction(expression);
        check("default", statement, fn);
      } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
        const clause = statement.exportClause;
        if (!clause || !ts.isNamedExports(clause)) {
          refuse(statement, "*");
          continue;
        }
        for (const element of clause.elements) {
          if (element.isTypeOnly) continue;
          const local = (element.propertyName ?? element.name).getText(
            sourceFile,
          );
          // Ré-export d'un autre module : aucune fonction écrite sur place à lire.
          const fn = statement.moduleSpecifier ? undefined : locals.get(local);
          check(element.name.getText(sourceFile), element, fn);
        }
      } else if (
        exported &&
        !ts.isTypeAliasDeclaration(statement) &&
        !ts.isInterfaceDeclaration(statement)
      ) {
        // export class, export enum… : pas une fonction gardée.
        refuse(statement, "export");
      }
    }
  }

  // Actions en ligne : fonctions dont le corps commence par "use server" (composant, etc.).
  const visit = (node: ts.Node) => {
    if (
      isFunctionLike(node) &&
      !judged.has(node) &&
      node.body &&
      ts.isBlock(node.body) &&
      prologue(node.body.statements).directives.includes("use server")
    ) {
      const name =
        node.name?.getText(sourceFile) ??
        (ts.isVariableDeclaration(node.parent)
          ? node.parent.name.getText(sourceFile)
          : "(anonyme)");
      check(name, node, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}
