import { and, eq, sql } from "drizzle-orm";

import type { UserTx } from "@/db/client";
import { shoppingItems, shoppingLists } from "@/db/schema/shopping";
import { uuidSchema } from "@/modules/core/schemas";

import type { AisleKey } from "./aisles";
import { classifyAisle } from "./classify";
import { ShoppingError } from "./errors";
import { DEFAULT_LIST_NAME, getAisleOverrides } from "./queries";

// Écritures du module shopping (ADR-002) : workspaceId en premier, transaction de withUserDb en dernier,
// filtre explicite sur workspaceId en plus de la RLS. Chaque écriture de la liste incrémente `rev` dans la
// même transaction (le trigger de 0011 n'accepte que rev ou rev + 1).
// INSERT en SQL écrit : app_backend n'a le droit INSERT que sur certaines colonnes (GRANT par colonne).
// Ordre des verrous, le même dans toutes les écritures : 1. lockList (verrou consultatif de la liste),
// 2. lignes (articles, puis la liste par la mise à jour de `rev`). Jamais lockList après un verrou de ligne.
// Pourquoi : un verrou de ligne ne sérialise pas un comptage (deux ajouts à 299 articles verraient tous
// deux 299 : l'insertion de l'autre n'est pas une ligne existante).

export const MAX_ITEMS_PER_LIST = 300;
export const MAX_LABEL_LENGTH = 80;

export type ListRef = { id: string; name: string; rev: number };

function parseWorkspace(workspaceId: unknown): string {
  const result = uuidSchema.safeParse(workspaceId);
  if (!result.success) throw new ShoppingError("invalid_params");
  return result.data;
}

/** Espaces internes réduits, bords retirés ; vide ou trop long → refus. Longueur en caractères (comme char_length). */
function cleanLabel(label: unknown): string {
  if (typeof label !== "string") throw new ShoppingError("invalid_params");
  const clean = label.replace(/\s+/gu, " ").trim();
  const length = [...clean].length;
  if (length === 0) throw new ShoppingError("invalid_params");
  if (length > MAX_LABEL_LENGTH) throw new ShoppingError("label_too_long");
  return clean;
}

/** Verrou de transaction propre à la liste. Une collision de hachage ne fait qu'une attente de plus. */
async function lockList(listId: string, tx: UserTx): Promise<void> {
  const name = `shopping.list:${listId.toLowerCase()}`;
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${name}, 0))`,
  );
}

/** Incrémente `rev` de la liste ; appelé en dernier d'une écriture, sous lockList. */
async function bumpRev(
  workspace: string,
  listId: string,
  tx: UserTx,
): Promise<number> {
  const [row] = await tx
    .update(shoppingLists)
    .set({ rev: sql`${shoppingLists.rev} + 1` })
    .where(
      and(
        eq(shoppingLists.workspaceId, workspace),
        eq(shoppingLists.id, listId),
      ),
    )
    .returning({ rev: shoppingLists.rev });
  if (!row) throw new ShoppingError("invalid_params");
  return row.rev;
}

/** La liste du workspace, créée au premier accès (une par workspace, contrainte unique). */
export async function ensureList(
  workspaceId: string,
  tx: UserTx,
): Promise<ListRef> {
  const workspace = parseWorkspace(workspaceId);
  await tx.execute(sql`
    insert into ${shoppingLists} (workspace_id, name)
    values (${workspace}, ${DEFAULT_LIST_NAME})
    on conflict (workspace_id) do nothing`);
  const [list] = await tx
    .select({
      id: shoppingLists.id,
      name: shoppingLists.name,
      rev: shoppingLists.rev,
    })
    .from(shoppingLists)
    .where(eq(shoppingLists.workspaceId, workspace));
  if (!list) throw new ShoppingError("invalid_params");
  return list;
}

export type AddedItem = {
  id: string;
  label: string;
  aisleKey: AisleKey;
  /** `rev` de la liste après l'ajout. */
  rev: number;
};

/** Ajoute un article, rangé par classifyAisle (corrections de l'utilisateur d'abord). */
export async function addItem(
  workspaceId: string,
  label: string,
  tx: UserTx,
): Promise<AddedItem> {
  const workspace = parseWorkspace(workspaceId);
  const clean = cleanLabel(label);
  const list = await ensureList(workspace, tx);

  await lockList(list.id, tx);
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.workspaceId, workspace),
        eq(shoppingItems.listId, list.id),
      ),
    );
  if (count >= MAX_ITEMS_PER_LIST) throw new ShoppingError("list_full");

  const overrides = await getAisleOverrides(workspace, tx);
  const { aisle } = classifyAisle(clean, { overrides });

  const result = await tx.execute<{ id: string }>(sql`
    insert into ${shoppingItems} (workspace_id, list_id, label, aisle_key)
    values (${workspace}, ${list.id}, ${clean}, ${aisle})
    returning id`);
  const rev = await bumpRev(workspace, list.id, tx);
  return { id: result.rows[0]!.id, label: clean, aisleKey: aisle, rev };
}
