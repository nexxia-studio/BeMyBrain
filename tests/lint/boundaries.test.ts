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

  it("eslint refuse import { env } de node:process dans src/app", async () => {
    const code = 'import { env } from "node:process";\nexport const x = env;\n';

    const errors = await restrictedImportRules(code, "src/app/probe.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse import { env } de process dans src/i18n", async () => {
    const code = 'import { env } from "process";\nexport const x = env;\n';

    const errors = await restrictedImportRules(code, "src/i18n/x.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse globalThis.process.env dans src/modules", async () => {
    const code = "export const x = globalThis.process.env.ANYTHING;\n";

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse process.env[variable] dans src/app", async () => {
    const code =
      'const name = "DATABASE_" + "URL";\nexport const x = process.env[name];\n';

    const errors = await restrictedImportRules(code, "src/app/probe.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un import dynamique dont la source est une variable", async () => {
    const code =
      'const path = "@/db/admin";\nexport const load = () => import(path);\n';

    const errors = await restrictedImportRules(code, "src/i18n/x.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un import dynamique dont la source est un template literal", async () => {
    const code =
      'const name = "admin";\nexport const load = () => import(`@/db/${name}`);\n';

    const errors = await restrictedImportRules(code, "src/i18n/x.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse require vers db/ avec un message ADR-002", async () => {
    const code = 'export const db = require("@/db/admin");\n';

    const errors = await restrictedImportRules(code, "src/i18n/x.ts");

    expect(errors.some((message) => message.includes("ADR-002"))).toBe(true);
  });

  it("eslint refuse pg dans src/modules", async () => {
    const code = 'import { Client } from "pg";\nexport const x = Client;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse postgres dans src/modules", async () => {
    const code =
      'import postgres from "postgres";\nexport const x = postgres;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse drizzle-orm/pg-core dans src/modules", async () => {
    const code =
      'import { pgTable } from "drizzle-orm/pg-core";\nexport const x = pgTable;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint autorise les opérateurs de drizzle-orm dans src/modules", async () => {
    const code =
      'import { and, eq } from "drizzle-orm";\nexport const x = [and, eq];\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors).toHaveLength(0);
  });

  it("eslint refuse @/db/client dans src/lib", async () => {
    const code =
      'import { withUserDb } from "@/db/client";\nexport const x = withUserDb;\n';

    const errors = await restrictedImportRules(code, "src/lib/probe.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un import relatif vers db/ dans src/lib", async () => {
    const code =
      'import { withUserDb } from "../db/client";\nexport const x = withUserDb;\n';

    const errors = await restrictedImportRules(code, "src/lib/probe.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint refuse un import de react dans src/modules/core", async () => {
    const code = 'import { cache } from "react";\nexport const x = cache;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/core/queries.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it.each(["src/modules/core/leak.ts", "src/app/page-leak.ts"])(
    "eslint refuse un import des helpers de test depuis %s",
    async (filePath) => {
      const code =
        'import { createTestUserDb } from "../../../tests/factories/as-user";\nexport const x = createTestUserDb;\n';

      const errors = await restrictedImportRules(code, filePath);

      expect(errors).toHaveLength(1);
    },
  );

  it("eslint refuse un import des helpers de test par l'alias @/", async () => {
    const code =
      'import { createTestUserDb } from "@/../tests/factories/as-user";\nexport const x = createTestUserDb;\n';

    const errors = await restrictedImportRules(code, "src/lib/leak.ts");

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint autorise les helpers de test dans un fichier de test de src/modules", async () => {
    const code =
      'import { createTestUserDb } from "../../../tests/factories/as-user";\nexport const x = createTestUserDb;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/core/x.test.ts",
    );

    expect(errors).toEqual([]);
  });

  it("eslint refuse un import des helpers de test dans src/db/migration-env.ts", async () => {
    const code =
      'import { createOwnerPool } from "../../tests/factories/core";\nexport const x = createOwnerPool;\n';

    const errors = await restrictedImportRules(code, "src/db/migration-env.ts");

    expect(errors).toHaveLength(1);
  });
});
