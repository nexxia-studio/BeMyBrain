import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { findLiteralMessages, isServerActionFile } from "./literal-messages";

// Convention (plan socle, Décisions, « Textes hors JSX ») : les messages d'erreur et les toasts affichés ne
// reçoivent qu'un appel t(...) ou une clé de message, jamais un littéral de texte. Exceptions au format
// "chemin/relatif.tsx:ligne". Vide par principe (ADR-007).
const EXCEPTIONS: readonly string[] = [];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(c|m)?(j|t)sx?$/.test(entry.name) &&
      !/\.test\.(c|m)?(j|t)sx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

const texts = (source: string, file = "Form.tsx") =>
  findLiteralMessages(source, file).map(({ line, text }) => ({ line, text }));

describe("toasts et erreurs ne reçoivent que t(...)", () => {
  it("signale un toast qui reçoit un littéral", () => {
    const source = `toast("Enregistré");
toast.error(\`Échec de \${name}\`);
toast.success(t("saved"), { description: "Tout est bon" });`;

    expect(texts(source)).toEqual([
      { line: 1, text: "Enregistré" },
      { line: 2, text: "Échec de" },
      { line: 3, text: "Tout est bon" },
    ]);
  });

  it("accepte un toast qui ne reçoit que t(...)", () => {
    const source = `toast(t("saved"));
toast.error(t("errors.failed"), { description: t("errors.retry") });`;

    expect(texts(source)).toEqual([]);
  });

  it("signale une erreur renvoyée en texte, accepte une clé de message", () => {
    const source = `export async function save() {
  if (a) return { error: "Impossible d'enregistrer" };
  if (b) return { error: "invalidCredentials", message: t("saved") };
  return { message: ok ? "Fait" : "notSaved" };
}`;

    expect(texts(source, "actions.ts")).toEqual([
      { line: 2, text: "Impossible d'enregistrer" },
      { line: 4, text: "Fait" },
    ]);
  });

  it("signale un setter d'erreur qui reçoit un littéral", () => {
    const source = `setError("Échec");
setErrorMessage(cond && "Réessaie plus tard");
setError("networkFailed");
setFailed(true);`;

    expect(texts(source)).toEqual([
      { line: 1, text: "Échec" },
      { line: 2, text: "Réessaie plus tard" },
    ]);
  });

  it("signale un message conditionnel en dur dans le JSX", () => {
    const source = `export function Status({ failed, t }: Props) {
  return (
    <p role="status">
      {failed ? "Action non lancée" : null}
      {pending && \`En cours\`}
      {failed ? t("error") : pending ? t("pending") : null}
    </p>
  );
}`;

    expect(texts(source)).toEqual([
      { line: 4, text: "Action non lancée" },
      { line: 5, text: "En cours" },
    ]);
  });

  it("signale l'affichage du message brut d'une erreur", () => {
    const source = `export function Oops({ error }: Props) {
  return <p role="alert">{error.message}</p>;
}`;

    expect(texts(source)).toEqual([{ line: 2, text: "error.message" }]);
  });

  it("reconnaît un fichier de Server Actions à sa directive", () => {
    expect(
      isServerActionFile(`"use server";\nexport async function a() {}`),
    ).toBe(true);
    expect(isServerActionFile(`// note\n'use server';`)).toBe(true);
    expect(isServerActionFile(`"use client";\nconst a = "use server";`)).toBe(
      false,
    );
  });

  it("aucune Server Action ni aucun composant n'affiche un message en dur", () => {
    const root = process.cwd();
    const src = join(root, "src");
    const components = listSourceFiles(join(src, "components"));
    const serverActions = listSourceFiles(src).filter(
      (path) =>
        !path.startsWith(join(src, "components")) &&
        isServerActionFile(readFileSync(path, "utf8")),
    );

    const found = [...components, ...serverActions]
      .flatMap((path) =>
        findLiteralMessages(readFileSync(path, "utf8"), relative(root, path)),
      )
      .filter(({ file, line }) => !EXCEPTIONS.includes(`${file}:${line}`))
      .map(({ file, line, text }) => `${file}:${line} ${text}`);

    expect(components.length).toBeGreaterThan(0);
    expect(serverActions.length).toBeGreaterThan(0);
    expect(found).toEqual([]);
  });
});
