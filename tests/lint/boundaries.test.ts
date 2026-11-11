import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

const BOUNDARY_RULES = ["no-restricted-imports", "no-restricted-syntax"];

async function restrictedImportRules(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => BOUNDARY_RULES.includes(message.ruleId ?? ""))
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

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un import relatif de db/admin dans un composant", async () => {
    const code =
      'import { adminDb } from "../db/admin";\nexport const x = adminDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/components/boundary-probe.tsx",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse la fabrique interne de withUserDb dans src/modules", async () => {
    const code =
      'import { createWithUserDb } from "@/db/user-db";\nexport const x = createWithUserDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
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

  it("eslint refuse un import relatif de ../../db/admin dans un composant", async () => {
    const code =
      'import { adminDb } from "../../db/admin";\nexport const x = adminDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/components/shell/boundary-probe.tsx",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un import relatif de db/client dans src/modules", async () => {
    const code =
      'import { withUserDb } from "../../db/client";\nexport const x = withUserDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint autorise @/db/schema dans src/modules", async () => {
    const code =
      'import { app } from "@/db/schema/app";\nexport const x = app;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors).toHaveLength(0);
  });

  it("eslint refuse un détour par @/db/schema/../admin dans src/modules", async () => {
    const code =
      'import { adminDb } from "@/db/schema/../admin";\nexport const x = adminDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse drizzle-orm dans src/lib", async () => {
    const code = 'import { sql } from "drizzle-orm";\nexport const x = sql;\n';

    const errors = await restrictedImportRules(code, "src/lib/probe.ts");

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse un import dynamique de @/db/client dans un composant", async () => {
    const code = 'export const load = () => import("@/db/client");\n';

    const errors = await restrictedImportRules(
      code,
      "src/components/boundary-probe.tsx",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un import dynamique de db/admin dans un module", async () => {
    const code = 'export const load = () => import("@/db/admin");\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un ré-export de @/db/client depuis src/lib", async () => {
    const code = 'export * from "@/db/client";\n';

    const errors = await restrictedImportRules(code, "src/lib/probe.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse @/db/admin dans src/middleware.ts", async () => {
    const code =
      'import { adminDb } from "@/db/admin";\nexport const x = adminDb;\n';

    const errors = await restrictedImportRules(code, "src/middleware.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse @/db/admin dans src/i18n", async () => {
    const code =
      'import { adminDb } from "@/db/admin";\nexport const x = adminDb;\n';

    const errors = await restrictedImportRules(code, "src/i18n/x.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse @/db/migration-env dans src/i18n", async () => {
    const code =
      'import { getMigrationEnv } from "@/db/migration-env";\nexport const x = getMigrationEnv;\n';

    const errors = await restrictedImportRules(code, "src/i18n/x.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse new Pool dans un module", async () => {
    const code =
      'import { Pool } from "@neondatabase/serverless";\nexport const pool = new Pool({});\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse drizzle-orm/neon-serverless hors de src/db", async () => {
    const code =
      'import { drizzle } from "drizzle-orm/neon-serverless";\nexport const x = drizzle;\n';

    const errors = await restrictedImportRules(code, "src/i18n/x.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse process.env.DATABASE_URL dans src/app", async () => {
    const code = "export const url = process.env.DATABASE_URL;\n";

    const errors = await restrictedImportRules(code, "src/app/probe.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it('eslint refuse process.env["DATABASE_URL"] dans src/db/client.ts', async () => {
    const code = 'export const url = process.env["DATABASE_URL"];\n';

    const errors = await restrictedImportRules(code, "src/db/client.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint autorise process.env.DATABASE_URL dans src/db/migration-env.ts", async () => {
    const code = "export const url = process.env.DATABASE_URL;\n";

    const errors = await restrictedImportRules(code, "src/db/migration-env.ts");

    expect(errors).toHaveLength(0);
  });
});
