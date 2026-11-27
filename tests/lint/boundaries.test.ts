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

  it.each(["src/i18n/x.ts", "src/proxy.ts", "src/app/probe.ts"])(
    "eslint refuse @/db/pool (pool brut, sans RLS) dans %s",
    async (filePath) => {
      const code =
        'import { createPool } from "@/db/pool";\nexport const x = createPool;\n';

      const errors = await restrictedImportRules(code, filePath);

      expect(errors.some((message) => message.includes("db/pool"))).toBe(true);
    },
  );

  it.each(["src/db/client.ts", "src/db/admin.ts"])(
    "eslint autorise ./pool dans %s",
    async (filePath) => {
      const code =
        'import { createPool } from "./pool";\nexport const x = createPool;\n';

      const errors = await restrictedImportRules(code, filePath);

      expect(errors).toHaveLength(0);
    },
  );

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
  it("eslint refuse drizzle-orm dans une déclaration d'actions de module", async () => {
    const code = 'import { eq } from "drizzle-orm";\nexport const x = eq;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/actions.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse @/db/schema dans une déclaration d'actions de module", async () => {
    const code =
      'import { app } from "@/db/schema/app";\nexport const x = app;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/actions.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint garde les frontières communes des modules dans actions.ts (next, db/admin)", async () => {
    const code =
      'import { headers } from "next/headers";\nimport { adminDb } from "@/db/admin";\nexport const x = [headers, adminDb];\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/actions.ts",
    );

    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("eslint refuse le registre d'actions dans une page", async () => {
    const code =
      'import { registry } from "@/modules/actions/registry";\nexport const x = registry;\n';

    const errors = await restrictedImportRules(code, "src/app/probe/page.tsx");

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse le registre d'actions dans les actions d'un module", async () => {
    const code =
      'import { registry } from "../actions/registry";\nexport const x = registry;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/core/actions.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse le registre d'actions par import relatif dans src/modules/actions", async () => {
    const code =
      'import { registry } from "./registry";\nexport const x = registry;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/actions/probe.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint refuse un import dynamique du registre d'actions", async () => {
    const code =
      'export const x = () => import("@/modules/actions/registry");\n';

    const errors = await restrictedImportRules(code, "src/lib/probe.ts");

    expect(errors).toHaveLength(1);
  });

  it("eslint autorise le registre d'actions dans src/modules/actions/run.ts", async () => {
    const code =
      'import { registry } from "./registry";\nexport const x = registry;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/actions/run.ts",
    );

    expect(errors).toEqual([]);
  });

  it("eslint garde les règles communes dans src/modules/actions/run.ts", async () => {
    const code = "export const x = process.env.DATABASE_URL;\n";

    const errors = await restrictedImportRules(
      code,
      "src/modules/actions/run.ts",
    );

    expect(errors).toHaveLength(1);
  });

  it("eslint autorise le registre d'actions dans un fichier de test", async () => {
    const code =
      'import { registry } from "@/modules/actions/registry";\nexport const x = registry;\n';

    const errors = await restrictedImportRules(
      code,
      "src/components/probe/probe.test.ts",
    );

    expect(errors).toEqual([]);
  });
});

// createRequire contourne no-restricted-imports et les sélecteurs require/import (audit sécurité BRAIN-50).
describe("createRequire dans src", () => {
  const viaCreateRequire =
    'import { createRequire } from "node:module";\nexport const admin = createRequire(import.meta.url)("@/db/admin");\n';

  it.each([
    "src/modules/probe/queries.ts",
    "src/components/boundary-probe.tsx",
    "src/app/probe/page.tsx",
    "src/lib/probe.ts",
    "src/modules/actions/probe.ts",
    "src/modules/actions/run.ts",
    "src/db/client.ts",
    "src/db/migration-env.ts",
    "src/proxy.ts",
  ])(
    'eslint refuse createRequire(import.meta.url)("@/db/admin") dans %s',
    async (filePath) => {
      const errors = await restrictedImportRules(viaCreateRequire, filePath);

      expect(errors.some((message) => /createRequire/.test(message))).toBe(
        true,
      );
    },
  );

  it("eslint refuse createRequire obtenu par import dynamique de module", async () => {
    const code =
      'const { createRequire } = await import("module");\nexport const x = createRequire;\n';

    const errors = await restrictedImportRules(
      code,
      "src/modules/probe/queries.ts",
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("eslint laisse createRequire aux fichiers de test de src", async () => {
    const errors = await restrictedImportRules(
      viaCreateRequire,
      "src/lib/probe.test.ts",
    );

    expect(errors.filter((message) => /createRequire/.test(message))).toEqual(
      [],
    );
  });
});

// Tableau kanban (BRAIN-46) : dnd-kit n'entre que par src/components/kanban/SortableBoard.tsx.
// Une config par zone pose no-restricted-imports / no-restricted-syntax : un fichier par zone.
const DND_KIT_GUARDED_FILES = [
  "src/components/tasks/TaskList.tsx",
  "src/components/kanban/SortableBoard.test.tsx",
  "src/components/kanban/OtherBoard.tsx",
  "src/components/tasks/TaskBoard.tsx",
  "src/modules/tasks/queries.ts",
  "src/modules/tasks/actions.ts",
  "src/modules/actions/probe.ts",
  "src/modules/actions/run.ts",
  "src/lib/probe.ts",
  "src/lib/probe.test.ts",
  "src/db/probe.ts",
  "src/db/probe.test.ts",
  "src/db/migration-env.ts",
  "tests/lint/probe.test.ts",
  "e2e/probe.spec.ts",
  "scripts/probe.ts",
];

// Chemins d'accès qui échappent à no-restricted-imports.
const DND_KIT_INDIRECT_IMPORTS = {
  "import()": 'export const x = await import("@dnd-kit/core");\n',
  require: 'export const x = require("@dnd-kit/sortable");\n',
  "typeof import()": 'export type X = typeof import("@dnd-kit/core");\n',
  "vi.mock": 'vi.mock("@dnd-kit/core");\n',
  "vi.doMock": 'vi.doMock("@dnd-kit/core", () => ({}));\n',
  "vi.unmock": 'vi.unmock("@dnd-kit/core");\n',
  "vi.doUnmock": 'vi.doUnmock("@dnd-kit/core");\n',
  "vi.importActual":
    'export const x = await vi.importActual("@dnd-kit/utilities");\n',
  "vi.importMock": 'export const x = await vi.importMock("@dnd-kit");\n',
};

describe("verrou d'import de dnd-kit", () => {
  const dndKitImport =
    'import { DndContext } from "@dnd-kit/core";\nexport const x = DndContext;\n';
  const isDndKitError = (message: string) => /dnd-kit/.test(message);

  it.each(DND_KIT_GUARDED_FILES)(
    "eslint refuse @dnd-kit/core dans %s",
    async (filePath) => {
      const errors = await restrictedImportRules(dndKitImport, filePath);

      expect(errors.filter(isDndKitError).length).toBeGreaterThan(0);
    },
  );

  it.each(
    DND_KIT_GUARDED_FILES.flatMap((filePath) =>
      Object.entries(DND_KIT_INDIRECT_IMPORTS).map(
        ([form, code]) => [form, filePath, code] as const,
      ),
    ),
  )("eslint refuse dnd-kit par %s dans %s", async (_form, filePath, code) => {
    const errors = await restrictedImportRules(code, filePath);

    expect(errors.filter(isDndKitError).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(DND_KIT_INDIRECT_IMPORTS))(
    "eslint laisse dnd-kit par %s à SortableBoard.tsx",
    async (_form, code) => {
      const errors = await restrictedImportRules(
        code,
        "src/components/kanban/SortableBoard.tsx",
      );

      expect(errors.filter(isDndKitError)).toEqual([]);
    },
  );

  it.each(["@dnd-kit/sortable", "@dnd-kit/utilities", "@dnd-kit"])(
    "eslint refuse aussi %s hors de SortableBoard",
    async (source) => {
      const code = `import * as dnd from "${source}";\nexport const x = dnd;\n`;

      const errors = await restrictedImportRules(
        code,
        "src/components/tasks/TaskList.tsx",
      );

      expect(errors.filter(isDndKitError).length).toBeGreaterThan(0);
    },
  );

  it("eslint laisse dnd-kit à SortableBoard.tsx", async () => {
    const errors = await restrictedImportRules(
      dndKitImport,
      "src/components/kanban/SortableBoard.tsx",
    );

    expect(errors).toEqual([]);
  });

  it.each([
    [
      "createRequire",
      'import { createRequire } from "node:module";\nexport const x = createRequire;\n',
    ],
    ["require de src/db", 'export const x = require("@/db/client");\n'],
  ])(
    "SortableBoard.tsx garde le socle de syntaxe : %s y reste refusé",
    async (_form, code) => {
      const errors = await restrictedImportRules(
        code,
        "src/components/kanban/SortableBoard.tsx",
      );

      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it("SortableBoard.tsx garde les autres frontières de l'UI", async () => {
    const code = 'import { db } from "@/db/client";\nexport const x = db;\n';

    const errors = await restrictedImportRules(
      code,
      "src/components/kanban/SortableBoard.tsx",
    );

    expect(errors).toHaveLength(1);
  });
});
