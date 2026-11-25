// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createAsUser } from "../factories/backend-tx";
import {
  deleteCoreFixture,
  insertCoreFixture,
  insertDualMember,
  newCoreFixture,
} from "../factories/core";
import {
  CHECK_VIOLATION,
  FOREIGN_KEY_VIOLATION,
  GRANT_REFUSAL,
  OK,
  outcome,
  RLS_REFUSAL,
  tagged,
  UNIQUE_VIOLATION,
} from "../factories/refusal";
import { insertTasksFixture, newTasksFixture } from "../factories/tasks";

// Isolation et contraintes de task_relations (drizzle/0009, ADR-002), en app_backend, claims posés à la
// main, AUCUN filtre applicatif. Les clauses `= any(...)` ne font que restreindre aux lignes de ce run.
// Chaque transaction d'app_backend est annulée ; les deux relations de départ, posées par le
// propriétaire, partent avec deleteCoreFixture.

vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/isolation-task-relations.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
const backend = new Pool({ connectionString: backendUrl, max: 2 });
const f = newCoreFixture();
const t = newTasksFixture();
/** relation de A : taskA bloque subtaskA */
const relationA = randomUUID();
/** relation de B : taskB bloque subtaskB */
const relationB = randomUUID();
/** Deux tâches de A dans l'ordre de leurs identifiants (uuid : ordre des octets = ordre du texte). */
const [lowA, highA] = [t.taskA, t.trashedTaskA].sort();

beforeAll(async () => {
  await tagged(
    (async () => {
      await insertCoreFixture(owner, f);
      await insertDualMember(owner, f);
      await insertTasksFixture(owner, f, t);
      await owner.query(
        `insert into task_relations (id, workspace_id, from_task_id, to_task_id, kind) values
           ($1, $2, $3, $4, 'blocks'), ($5, $6, $7, $8, 'blocks')`,
        [
          relationA,
          f.workspaceA,
          t.taskA,
          t.subtaskA,
          relationB,
          f.workspaceB,
          t.taskB,
          t.subtaskB,
        ],
      );
    })(),
  );
});

// Exécuté même si l'insertion échoue à mi-chemin : suppression par workspace.
afterAll(async () => {
  try {
    await tagged(deleteCoreFixture(owner, f));
  } finally {
    await Promise.all([owner.end(), backend.end()]);
  }
});

const rawAsUser = createAsUser(backend);
const asUser: typeof rawAsUser = (sub, run) => tagged(rawAsUser(sub, run));

const INSERT =
  "insert into task_relations (workspace_id, from_task_id, to_task_id, kind) values ($1, $2, $3, $4)";

function insertRelation(
  db: PoolClient,
  workspaceId: string,
  from: string,
  to: string,
  kind: string,
) {
  return db.query(INSERT, [workspaceId, from, to, kind]);
}

async function countRelations(db: PoolClient, workspaceIds: string[]) {
  const result = await db.query(
    "select count(*)::int as n from task_relations where workspace_id = any($1)",
    [workspaceIds],
  );
  return result.rows[0].n as number;
}

describe("isolation de task_relations : lecture", () => {
  it("l'utilisateur de B ne lit aucune relation de A", async () => {
    const seen = await asUser(f.userB, (db) =>
      countRelations(db, [f.workspaceA]),
    );

    expect(seen).toBe(0);
  });

  it("l'utilisateur de B lit ses propres relations", async () => {
    const seen = await asUser(f.userB, (db) =>
      countRelations(db, [f.workspaceA, f.workspaceB]),
    );

    expect(seen).toBe(1);
  });

  it("un membre de A lit les relations de A, pas celles de B", async () => {
    const seen = await asUser(f.userA2, async (db) => {
      const result = await db.query(
        "select id from task_relations where workspace_id = any($1)",
        [[f.workspaceA, f.workspaceB]],
      );
      return result.rows.map((row) => row.id);
    });

    expect(seen).toEqual([relationA]);
  });

  it("sans claims, ne lit rien", async () => {
    const seen = await asUser(null, (db) =>
      countRelations(db, [f.workspaceA, f.workspaceB]),
    );

    expect(seen).toBe(0);
  });
});

describe("isolation de task_relations : insertion", () => {
  it("l'utilisateur de B ne peut pas insérer une relation dans A (la même instruction passe pour un membre de A)", async () => {
    const attempt = (sub: string) =>
      outcome(
        asUser(sub, (db) =>
          insertRelation(db, f.workspaceA, t.subtaskA, t.taskA, "blocks"),
        ),
      );

    const outcomes = {
      userB: await attempt(f.userB),
      memberOfA: await attempt(f.userA2),
    };

    expect(outcomes).toEqual({ userB: RLS_REFUSAL, memberOfA: OK });
  });

  // userAB est membre de A et de B : la RLS laisse passer les deux workspace_id, seule la clé étrangère
  // composite répond.
  it.each([
    ["A", "de A vers B", () => [f.workspaceA, t.taskA, t.taskB]],
    ["A", "de B vers A", () => [f.workspaceA, t.taskB, t.taskA]],
    ["B", "de A vers B", () => [f.workspaceB, t.taskA, t.taskB]],
    ["B", "de B vers A", () => [f.workspaceB, t.taskB, t.taskA]],
  ])(
    "refuse une relation entre une tâche de A et une tâche de B, rangée dans %s, %s, même pour un membre des deux (clé étrangère composite)",
    async (_workspace, _direction, params) => {
      const [workspaceId, from, to] = params();

      const outcomes = {
        blocks: await outcome(
          asUser(f.userAB, (db) =>
            insertRelation(db, workspaceId, from, to, "blocks"),
          ),
        ),
        related: await outcome(
          asUser(f.userAB, (db) =>
            insertRelation(db, workspaceId, ...sorted(from, to), "related"),
          ),
        ),
      };

      expect(outcomes).toEqual({
        blocks: FOREIGN_KEY_VIOLATION,
        related: FOREIGN_KEY_VIOLATION,
      });
    },
  );

  it("l'utilisateur de B ne peut pas relier sa tâche à une tâche de A, quel que soit le workspace_id posé", async () => {
    const attempt = (workspaceId: string) =>
      outcome(
        asUser(f.userB, (db) =>
          insertRelation(db, workspaceId, t.taskB, t.taskA, "blocks"),
        ),
      );

    const outcomes = {
      inB: await attempt(f.workspaceB),
      inA: await attempt(f.workspaceA),
    };

    expect(outcomes).toEqual({ inB: FOREIGN_KEY_VIOLATION, inA: RLS_REFUSAL });
  });

  // L'unicité porte workspace_id : la ligne de B ne heurte jamais celle de A, seule la clé étrangère
  // répond (pas d'oracle d'existence entre workspaces, comme task_tags_pk).
  it.each([
    ["sans ON CONFLICT", ""],
    ["avec ON CONFLICT DO NOTHING", "on conflict do nothing"],
  ])(
    "B ne peut pas sonder une relation de A (%s) : même refus qu'elle existe chez A ou non",
    async (_label, onConflict) => {
      const attempt = (from: string, to: string) =>
        outcome(
          asUser(f.userB, (db) =>
            db.query(`${INSERT} ${onConflict}`, [
              f.workspaceB,
              from,
              to,
              "blocks",
            ]),
          ),
        );

      const outcomes = {
        existsInA: await attempt(t.taskA, t.subtaskA),
        absentInA: await attempt(t.subtaskA, t.taskA),
      };

      expect(outcomes).toEqual({
        existsInA: FOREIGN_KEY_VIOLATION,
        absentInA: FOREIGN_KEY_VIOLATION,
      });
    },
  );

  it("un membre de A insère une relation : id et created_at posés par la base, updated_at vide", async () => {
    const rows = await asUser(f.userA2, async (db) => {
      const result = await db.query(
        `${INSERT} returning id is not null as has_id, created_at is not null as has_created_at, updated_at`,
        [f.workspaceA, t.subtaskA, t.taskA, "blocks"],
      );
      return result.rows;
    });

    expect(rows).toEqual([
      { has_id: true, has_created_at: true, updated_at: null },
    ]);
  });

  it.each([
    ["id", "gen_random_uuid()"],
    ["created_at", "now()"],
    ["updated_at", "now()"],
  ])(
    "app_backend ne peut pas poser %s à l'insertion (droit de colonne)",
    async (column, value) => {
      const insert = asUser(f.userA, (db) =>
        db.query(
          `insert into task_relations (workspace_id, from_task_id, to_task_id, kind, ${column})
           values ($1, $2, $3, 'blocks', ${value})`,
          [f.workspaceA, t.subtaskA, t.taskA],
        ),
      );

      expect(await outcome(insert)).toBe(GRANT_REFUSAL);
    },
  );
});

/** Les deux identifiants, le plus petit d'abord (ordre attendu d'une relation « liée à »). */
function sorted(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

describe("task_relations : contraintes", () => {
  it.each(["blocks", "related"])(
    "refuse une relation « %s » d'une tâche avec elle-même",
    async (kind) => {
      const insert = asUser(f.userA, (db) =>
        insertRelation(db, f.workspaceA, t.taskA, t.taskA, kind),
      );

      expect(await outcome(insert)).toBe(CHECK_VIOLATION);
    },
  );

  it("range une relation « liée à » une seule fois : plus petit identifiant en premier, l'inverse est refusé", async () => {
    const attempt = (from: string, to: string) =>
      outcome(
        asUser(f.userA, (db) =>
          insertRelation(db, f.workspaceA, from, to, "related"),
        ),
      );

    const outcomes = {
      lowToHigh: await attempt(lowA, highA),
      highToLow: await attempt(highA, lowA),
    };

    expect(outcomes).toEqual({ lowToHigh: OK, highToLow: CHECK_VIOLATION });
  });

  it("accepte un blocage dans les deux ordres d'identifiants", async () => {
    const attempt = (from: string, to: string) =>
      outcome(
        asUser(f.userA, (db) =>
          insertRelation(db, f.workspaceA, from, to, "blocks"),
        ),
      );

    const outcomes = {
      lowToHigh: await attempt(lowA, highA),
      highToLow: await attempt(highA, lowA),
    };

    expect(outcomes).toEqual({ lowToHigh: OK, highToLow: OK });
  });

  it("refuse un type de relation inconnu", async () => {
    const insert = asUser(f.userA, (db) =>
      insertRelation(db, f.workspaceA, t.subtaskA, t.taskA, "duplicates"),
    );

    expect(await outcome(insert)).toBe(CHECK_VIOLATION);
  });

  it("refuse un doublon (même workspace, mêmes tâches, même type)", async () => {
    const insert = asUser(f.userA, (db) =>
      insertRelation(db, f.workspaceA, t.taskA, t.subtaskA, "blocks"),
    );

    expect(await outcome(insert)).toBe(UNIQUE_VIOLATION);
  });

  it("accepte les mêmes tâches reliées par un autre type", async () => {
    const insert = asUser(f.userA, (db) =>
      insertRelation(
        db,
        f.workspaceA,
        ...sorted(t.taskA, t.subtaskA),
        "related",
      ),
    );

    expect(await outcome(insert)).toBe(OK);
  });
});

describe("isolation de task_relations : suppression et modification", () => {
  it("l'utilisateur de B ne supprime pas une relation de A (la même instruction touche une ligne pour un membre de A)", async () => {
    const remove = (sub: string) =>
      asUser(
        sub,
        async (db) =>
          (
            await db.query(
              "delete from task_relations where id = $1 returning id",
              [relationA],
            )
          ).rows,
      );

    const removed = {
      userB: await remove(f.userB),
      memberOfA: await remove(f.userA2),
    };

    expect(removed).toEqual({ userB: [], memberOfA: [{ id: relationA }] });
  });

  it.each([
    ["le type", "update task_relations set kind = 'related' where id = $1"],
    [
      "le sens",
      "update task_relations set from_task_id = to_task_id, to_task_id = from_task_id where id = $1",
    ],
    [
      "le workspace",
      "update task_relations set workspace_id = workspace_id where id = $1",
    ],
    [
      "updated_at",
      "update task_relations set updated_at = now() where id = $1",
    ],
  ])(
    "app_backend ne peut pas modifier %s d'une relation, même la sienne (droit, pas RLS)",
    async (_label, sql) => {
      const update = asUser(f.userA, (db) => db.query(sql, [relationA]));

      expect(await outcome(update)).toBe(GRANT_REFUSAL);
    },
  );
});

describe("task_relations : catalogue", () => {
  it("la RLS est activée et il y a exactement trois policies, une par verbe, pour app_backend, par appartenance au workspace", async () => {
    const MEMBER = "app.is_workspace_member(workspace_id)";

    const result = await tagged(
      owner.query(
        `select c.relrowsecurity as rls,
           coalesce(
             json_agg(json_build_object('verb', p.cmd, 'roles', p.roles::text, 'permissive', p.permissive,
               'using', p.qual, 'check', p.with_check) order by p.cmd)
               filter (where p.policyname is not null),
             '[]'
           ) as policies
         from pg_class c
         left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
         where c.oid = 'public.task_relations'::regclass
         group by c.relrowsecurity`,
      ),
    );

    const policy = { roles: "{app_backend}", permissive: "PERMISSIVE" };
    expect(result.rows).toEqual([
      {
        rls: true,
        policies: [
          { ...policy, verb: "DELETE", using: MEMBER, check: null },
          { ...policy, verb: "INSERT", using: null, check: MEMBER },
          { ...policy, verb: "SELECT", using: MEMBER, check: null },
        ],
      },
    ]);
  });

  it("app_backend a SELECT, DELETE et INSERT sur quatre colonnes ; ni UPDATE, ni TRUNCATE", async () => {
    const result = await tagged(
      owner.query(
        `select
           has_table_privilege('app_backend', 'public.task_relations', 'SELECT') as "select",
           has_table_privilege('app_backend', 'public.task_relations', 'DELETE') as "delete",
           has_table_privilege('app_backend', 'public.task_relations', 'INSERT') as insert_all,
           has_any_column_privilege('app_backend', 'public.task_relations', 'UPDATE') as update_any,
           has_table_privilege('app_backend', 'public.task_relations', 'TRUNCATE') as "truncate",
           (select array_agg(a.attname::text order by a.attname)
              from pg_attribute a
              where a.attrelid = 'public.task_relations'::regclass and a.attnum > 0 and not a.attisdropped
                and has_column_privilege('app_backend', a.attrelid, a.attnum, 'INSERT')) as insert_columns`,
      ),
    );

    expect(result.rows).toEqual([
      {
        select: true,
        delete: true,
        insert_all: false,
        update_any: false,
        truncate: false,
        insert_columns: ["from_task_id", "kind", "to_task_id", "workspace_id"],
      },
    ]);
  });

  it("indexe les relations par workspace et tâche d'arrivée, et tient updated_at par trigger", async () => {
    const result = await tagged(
      owner.query(
        `select
           (select indexdef from pg_indexes
              where schemaname = 'public' and indexname = 'task_relations_workspace_to_task_idx') as index,
           (select pg_get_triggerdef(oid) from pg_trigger
              where tgrelid = 'public.task_relations'::regclass and not tgisinternal) as trigger`,
      ),
    );

    expect(result.rows).toEqual([
      {
        index: expect.stringMatching(/\(workspace_id, to_task_id\)$/),
        trigger: expect.stringMatching(
          /BEFORE UPDATE ON public\.task_relations FOR EACH ROW EXECUTE FUNCTION app\.set_updated_at\(\)$/,
        ),
      },
    ]);
  });
});
