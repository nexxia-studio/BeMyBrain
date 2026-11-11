import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function restrictedImportRules(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-imports")
    .map((message) => message.message);
}

describe("frontières d'import", () => {
  it("eslint refuse un import de @/db dans un composant", async () => {
    const code = 'import { db } from "@/db/client";\nexport const x = db;\n';

    const errors = await restrictedImportRules(
      code,
      "src/components/boundary-probe.tsx",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse un import de next dans src/modules", async () => {
    const code =
      'import { headers } from "next/headers";\nexport const x = headers;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse un import de @/db/admin dans src/modules", async () => {
    const code =
      'import { adminDb } from "@/db/admin";\nexport const x = adminDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse un import relatif de db/admin dans un composant", async () => {
    const code =
      'import { adminDb } from "../db/admin";\nexport const x = adminDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/components/boundary-probe.tsx",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse la fabrique interne de withUserDb dans src/modules", async () => {
    const code =
      'import { createWithUserDb } from "@/db/user-db";\nexport const x = createWithUserDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint autorise withUserDb dans src/modules", async () => {
    const code =
      'import { withUserDb } from "@/db/client";\nexport const x = withUserDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors).toHaveLength(0);
  });
});
