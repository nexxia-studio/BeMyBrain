// @vitest-environment node
import { Pool } from "@neondatabase/serverless";
import { afterAll, describe, expect, it } from "vitest";

import { AISLE_KEYS } from "../../src/modules/shopping/aisles";
import { tagged } from "../factories/refusal";

// Migration 0011 (listes de courses) lue dans le catalogue Postgres, jamais dans le fichier SQL :
// drizzle-kit écrit les colonnes qualifiées, Postgres les rend autrement (gotcha CHECK). Exige 0011
// appliquée : rouge en local tant qu'elle ne l'est pas (jamais avant la fusion de sa PR), verte sur la
// base éphémère de la CI.

const ownerUrl = process.env.DATABASE_TEST_URL;
if (!ownerUrl) {
  throw new Error(
    "tests/db/migration-0011.test.ts : DATABASE_TEST_URL requise (branche Neon test). Voir .env.example.",
  );
}

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
afterAll(() => owner.end());

const TABLES = [
  "shopping_lists",
  "shopping_items",
  "shopping_aisle_overrides",
  "shopping_aisle_order",
];

async function checkDefinition(constraint: string): Promise<string> {
  const result = await tagged(
    owner.query(
      `select pg_get_constraintdef(oid) as def from pg_constraint
       where conname = $1 and contype = 'c' and connamespace = 'public'::regnamespace`,
      [constraint],
    ),
  );
  expect(result.rows).toHaveLength(1);
  return result.rows[0].def as string;
}

/** Littéraux entre apostrophes d'une définition de CHECK, sans doublon, triés. */
function literals(definition: string): string[] {
  const found = [...definition.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  return [...new Set(found)].sort();
}

const EXPECTED_KEYS = [...AISLE_KEYS].sort();

describe("migration 0011 : le catalogue Postgres", () => {
  it.each([
    "shopping_items_aisle_key_check",
    "shopping_aisle_overrides_aisle_key_check",
    "shopping_aisle_order_keys_check",
  ])("le CHECK « %s » correspond exactement à AISLE_KEYS", async (name) => {
    const definition = await checkDefinition(name);

    expect(literals(definition)).toEqual(EXPECTED_KEYS);
  });

  it("le CHECK de l'ordre borne la longueur à 12 rayons", async () => {
    const definition = await checkDefinition("shopping_aisle_order_keys_check");

    expect(definition).toMatch(/cardinality\(\w*\.?"?aisle_keys"?\)\s*<=\s*12/);
    expect(AISLE_KEYS).toHaveLength(12);
  });

  it.each([
    ["shopping_items_label_check"],
    ["shopping_aisle_overrides_keyword_check"],
  ])("le CHECK « %s » borne le texte à 80 caractères", async (name) => {
    const definition = await checkDefinition(name);

    expect(definition).toMatch(/80/);
    expect(definition).toMatch(/char_length/);
  });

  it.each(TABLES)("la RLS est activée sur %s", async (table) => {
    const result = await tagged(
      owner.query(
        "select relrowsecurity from pg_class where oid = ('public.' || $1)::regclass",
        [table],
      ),
    );

    expect(result.rows).toEqual([{ relrowsecurity: true }]);
  });

  const EXPECTED_VERBS: [string, string[]][] = [
    ["shopping_lists", ["INSERT", "SELECT", "UPDATE"]],
    ["shopping_items", ["DELETE", "INSERT", "SELECT", "UPDATE"]],
    ["shopping_aisle_overrides", ["INSERT", "SELECT", "UPDATE"]],
    ["shopping_aisle_order", ["INSERT", "SELECT", "UPDATE"]],
  ];

  it.each(EXPECTED_VERBS)(
    "%s a exactement une policy par verbe attendu, jamais FOR ALL",
    async (table, verbs) => {
      const result = await tagged(
        owner.query(
          `select cmd, count(*)::int as n from pg_policies
           where schemaname = 'public' and tablename = $1
           group by cmd order by cmd`,
          [table],
        ),
      );

      expect(result.rows).toEqual(verbs.map((cmd) => ({ cmd, n: 1 })));
    },
  );

  it.each(TABLES)(
    "les policies de %s filtrent : ni USING (true) ni WITH CHECK (true)",
    async (table) => {
      const result = await tagged(
        owner.query(
          `select cmd, qual, with_check from pg_policies
           where schemaname = 'public' and tablename = $1`,
          [table],
        ),
      );
      const trivial = /^\(?true\)?$/;

      for (const row of result.rows) {
        if (row.cmd !== "INSERT") expect(row.qual).not.toMatch(trivial);
        if (row.cmd !== "SELECT" && row.cmd !== "DELETE") {
          expect(row.with_check).not.toMatch(trivial);
        }
        if (row.cmd === "SELECT" || row.cmd === "DELETE") {
          expect(row.qual).toContain("is_workspace_member");
        }
        if (row.cmd === "INSERT") {
          expect(row.with_check).toContain("is_workspace_member");
        }
        if (row.cmd === "UPDATE") {
          expect(row.qual).toContain("is_workspace_member");
          expect(row.with_check).toContain("is_workspace_member");
        }
      }
    },
  );

  it.each(["shopping_aisle_overrides", "shopping_aisle_order"])(
    "les policies de %s exigent l'utilisateur connecté en plus de l'appartenance",
    async (table) => {
      const result = await tagged(
        owner.query(
          `select cmd, coalesce(qual, '') || coalesce(with_check, '') as expr
           from pg_policies where schemaname = 'public' and tablename = $1`,
          [table],
        ),
      );

      expect(result.rows.length).toBeGreaterThan(0);
      for (const row of result.rows) {
        expect(row.expr).toContain("is_workspace_member");
        expect(row.expr).toContain("current_user_id");
      }
    },
  );

  it("workspace_id est NOT NULL partout", async () => {
    const result = await tagged(
      owner.query(
        `select table_name from information_schema.columns
         where table_schema = 'public' and column_name = 'workspace_id'
           and is_nullable = 'YES' and table_name = any($1)`,
        [TABLES],
      ),
    );

    expect(result.rows).toEqual([]);
  });

  it("rev vaut 0 et channel_id un uuid aléatoire par défaut", async () => {
    const result = await tagged(
      owner.query(
        `select column_name, column_default from information_schema.columns
         where table_schema = 'public' and table_name = 'shopping_lists'
           and column_name in ('rev', 'channel_id') order by column_name`,
      ),
    );

    expect(result.rows).toEqual([
      { column_name: "channel_id", column_default: "gen_random_uuid()" },
      { column_name: "rev", column_default: "0" },
    ]);
  });

  it("rev est borné par un CHECK rev >= 0", async () => {
    const definition = await checkDefinition("shopping_lists_rev_check");

    expect(definition).toMatch(/rev\W+>=\s*0/);
  });

  it("un trigger BEFORE UPDATE garde rev (fonction app, SECURITY INVOKER, search_path vide, rien pour PUBLIC)", async () => {
    const trigger = await tagged(
      owner.query(
        `select p.proname, p.prosecdef, p.proconfig, n.nspname,
                (t.tgtype & 2) <> 0 as before_row, (t.tgtype & 16) <> 0 as on_update,
                has_function_privilege('public', p.oid, 'EXECUTE') as public_exec
         from pg_trigger t
         join pg_proc p on p.oid = t.tgfoid
         join pg_namespace n on n.oid = p.pronamespace
         where t.tgrelid = 'public.shopping_lists'::regclass and not t.tgisinternal
           and t.tgname = 'shopping_lists_guard_rev'`,
      ),
    );

    expect(trigger.rows).toEqual([
      {
        proname: "guard_shopping_rev",
        prosecdef: false,
        proconfig: ["search_path="],
        nspname: "app",
        before_row: true,
        on_update: true,
        public_exec: false,
      },
    ]);
  });
});
