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

  it.each(TABLES)(
    "%s a une policy par verbe, jamais FOR ALL, jamais USING (true)",
    async (table) => {
      const result = await tagged(
        owner.query(
          `select cmd, count(*)::int as n,
                  bool_and(coalesce(qual, with_check) !~ '^\\(?true\\)?$') as filtered
           from pg_policies where schemaname = 'public' and tablename = $1
           group by cmd order by cmd`,
          [table],
        ),
      );
      const perVerb = result.rows.map((r) => [r.cmd, r.n, r.filtered]);

      expect(
        perVerb.every(
          ([cmd, n, filtered]) => cmd !== "ALL" && n === 1 && filtered,
        ),
      ).toBe(true);
      expect(perVerb.map(([cmd]) => cmd)).toContain("SELECT");
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
});
