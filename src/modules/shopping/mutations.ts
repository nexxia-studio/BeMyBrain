import { and, eq, isNotNull, sql } from "drizzle-orm";

import type { UserTx } from "@/db/client";
import {
  shoppingAisleOrder,
  shoppingAisleOverrides,
  shoppingItems,
  shoppingLists,
} from "@/db/schema/shopping";
import { uuidSchema } from "@/modules/core/schemas";

import { AISLE_KEYS, type AisleKey } from "./aisles";
import { classifyAisle } from "./classify";
import { ShoppingError } from "./errors";
import { normalizeLabel } from "./normalize";
import { DEFAULT_LIST_NAME, getAisleOverrides } from "./queries";

// Écritures du module shopping (ADR-002) : workspaceId en premier, transaction de withUserDb en dernier,
// filtre explicite sur workspaceId en plus de la RLS. Chaque écriture de la liste incrémente `rev` dans la
// même transaction (le trigger de 0011 n'accepte que rev ou rev + 1).
// INSERT en SQL écrit : app_backend n'a le droit INSERT que sur certaines colonnes (GRANT par colonne).
// Ordre des verrous, le même dans toutes les écritures : 1. lockList (verrou consultatif de la liste),
// 2. lignes (articles, puis la liste par la mise à jour de `rev`). Jamais lockList après un verrou de ligne.
// Seule exception apparente : au tout premier ajout, l'INSERT d'ensureList précède lockList ; sans
// interblocage possible, aucun autre écrivain ne connaît encore l'id de la liste.
// Pourquoi : un verrou de ligne ne sérialise pas un comptage (deux ajouts à 299 articles verraient tous
// deux 299 : l'insertion de l'autre n'est pas une ligne existante).

export const MAX_ITEMS_PER_LIST = 300;
export const MAX_LABEL_LENGTH = 80;
// Plafond applicatif (aucune contrainte en base : un COUNT n'est pas exprimable en CHECK) : corrections de
// rayon mémorisées par (workspace, utilisateur). Compté sous lockList, qui sérialise les écrivains du workspace.
export const MAX_AISLE_OVERRIDES = 500;

export type ListRef = { id: string; name: string; rev: number };

function parseWorkspace(workspaceId: unknown): string {
  const result = uuidSchema.safeParse(workspaceId);
  if (!result.success) throw new ShoppingError("invalid_params");
  return result.data;
}

/**
 * Normalisé en NFC, espaces internes réduits, bords retirés. Refus (invalid_params) : caractère de contrôle
 * (\p{Cc}), caractère de format invisible (\p{Cf} : U+200B, inversions U+202E, isolats U+2066-2069…),
 * libellé sans aucun caractère visible (lettre, chiffre, ponctuation ou symbole), vide ; trop long →
 * label_too_long. Longueur en caractères NFC (comme char_length côté base, qui reçoit la forme NFC).
 */
export function cleanLabel(label: unknown): string {
  if (typeof label !== "string") throw new ShoppingError("invalid_params");
  const clean = label.normalize("NFC").replace(/\s+/gu, " ").trim();
  // Les blancs (tabulation, saut de ligne) sont déjà devenus des espaces ; reste NUL, cloche, DEL, etc.
  if (/[\p{Cc}\p{Cf}]/u.test(clean)) throw new ShoppingError("invalid_params");
  if (!/[\p{L}\p{N}\p{P}\p{S}]/u.test(clean)) {
    throw new ShoppingError("invalid_params");
  }
  const length = [...clean].length;
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

function parseItemId(itemId: unknown): string {
  const result = uuidSchema.safeParse(itemId);
  if (!result.success) throw new ShoppingError("invalid_params");
  return result.data;
}

/** Id de la liste du workspace, lue sans la créer (une écriture sur un article suppose une liste existante). */
async function findListId(workspace: string, tx: UserTx): Promise<string> {
  const [list] = await tx
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(eq(shoppingLists.workspaceId, workspace));
  if (!list) throw new ShoppingError("invalid_params");
  return list.id;
}

/** `rev` de la liste, lu sous lockList. */
async function readRev(
  workspace: string,
  listId: string,
  tx: UserTx,
): Promise<number> {
  const [row] = await tx
    .select({ rev: shoppingLists.rev })
    .from(shoppingLists)
    .where(
      and(
        eq(shoppingLists.workspaceId, workspace),
        eq(shoppingLists.id, listId),
      ),
    );
  if (!row) throw new ShoppingError("invalid_params");
  return row.rev;
}

const itemScope = (workspace: string, listId: string, itemId: string) =>
  and(
    eq(shoppingItems.workspaceId, workspace),
    eq(shoppingItems.listId, listId),
    eq(shoppingItems.id, itemId),
  );

/**
 * Coche un article (date de cochage posée ; déjà coché : date conservée, son rang ne bouge pas).
 * Un article déjà coché incrémente quand même `rev` (relecture inutile chez les autres appareils, sans danger) :
 * le trigger n'accepte que rev + 1, et un test « rien n'a changé » coûterait une lecture de plus sous le verrou.
 * Article inconnu ou d'un autre workspace → invalid_params. Renvoie le `rev` de la liste.
 */
export async function checkItem(
  workspaceId: string,
  itemId: string,
  tx: UserTx,
): Promise<{ rev: number }> {
  const workspace = parseWorkspace(workspaceId);
  const id = parseItemId(itemId);
  const listId = await findListId(workspace, tx);

  await lockList(listId, tx);
  const rows = await tx
    .update(shoppingItems)
    .set({ checkedAt: sql`coalesce(${shoppingItems.checkedAt}, now())` })
    .where(itemScope(workspace, listId, id))
    .returning({ id: shoppingItems.id });
  if (rows.length === 0) throw new ShoppingError("invalid_params");
  return { rev: await bumpRev(workspace, listId, tx) };
}

/** Décoche un article (il remonte dans son rayon). Même refus et même retour que checkItem. */
export async function uncheckItem(
  workspaceId: string,
  itemId: string,
  tx: UserTx,
): Promise<{ rev: number }> {
  const workspace = parseWorkspace(workspaceId);
  const id = parseItemId(itemId);
  const listId = await findListId(workspace, tx);

  await lockList(listId, tx);
  const rows = await tx
    .update(shoppingItems)
    .set({ checkedAt: null })
    .where(itemScope(workspace, listId, id))
    .returning({ id: shoppingItems.id });
  if (rows.length === 0) throw new ShoppingError("invalid_params");
  return { rev: await bumpRev(workspace, listId, tx) };
}

export type RenamedItem = {
  id: string;
  label: string;
  aisleKey: AisleKey;
  rev: number;
};

/** Renomme un article ; reclassé par classifyAisle seulement si son rayon n'a pas été choisi à la main. */
export async function renameItem(
  workspaceId: string,
  itemId: string,
  label: string,
  tx: UserTx,
): Promise<RenamedItem> {
  const workspace = parseWorkspace(workspaceId);
  const id = parseItemId(itemId);
  const clean = cleanLabel(label);
  const listId = await findListId(workspace, tx);

  await lockList(listId, tx);
  const [current] = await tx
    .select({
      aislePinned: shoppingItems.aislePinned,
      aisleKey: shoppingItems.aisleKey,
    })
    .from(shoppingItems)
    .where(itemScope(workspace, listId, id))
    .for("update");
  if (!current) throw new ShoppingError("invalid_params");

  let aisleKey = current.aisleKey as AisleKey;
  if (!current.aislePinned) {
    const overrides = await getAisleOverrides(workspace, tx);
    aisleKey = classifyAisle(clean, { overrides }).aisle;
  }
  await tx
    .update(shoppingItems)
    .set({ label: clean, aisleKey })
    .where(itemScope(workspace, listId, id));
  const rev = await bumpRev(workspace, listId, tx);
  return { id, label: clean, aisleKey, rev };
}

/** Supprime un article. Inconnu ou d'un autre workspace → invalid_params. */
export async function removeItem(
  workspaceId: string,
  itemId: string,
  tx: UserTx,
): Promise<{ rev: number }> {
  const workspace = parseWorkspace(workspaceId);
  const id = parseItemId(itemId);
  const listId = await findListId(workspace, tx);

  await lockList(listId, tx);
  const rows = await tx
    .delete(shoppingItems)
    .where(itemScope(workspace, listId, id))
    .returning({ id: shoppingItems.id });
  if (rows.length === 0) throw new ShoppingError("invalid_params");
  return { rev: await bumpRev(workspace, listId, tx) };
}

/** Supprime les articles cochés et eux seuls. Rien à supprimer : aucune écriture, `rev` inchangé. */
export async function clearChecked(
  workspaceId: string,
  tx: UserTx,
): Promise<{ removed: number; rev: number }> {
  const workspace = parseWorkspace(workspaceId);
  const listId = await findListId(workspace, tx);

  await lockList(listId, tx);
  const rows = await tx
    .delete(shoppingItems)
    .where(
      and(
        eq(shoppingItems.workspaceId, workspace),
        eq(shoppingItems.listId, listId),
        isNotNull(shoppingItems.checkedAt),
      ),
    )
    .returning({ id: shoppingItems.id });
  if (rows.length === 0) {
    return { removed: 0, rev: await readRev(workspace, listId, tx) };
  }
  return {
    removed: rows.length,
    rev: await bumpRev(workspace, listId, tx),
  };
}

const isAisleKey = (key: unknown): key is AisleKey =>
  typeof key === "string" && (AISLE_KEYS as readonly string[]).includes(key);

export type MovedItem = { id: string; aisleKey: AisleKey; rev: number };

/**
 * Change un article de rayon à la main : `aisle_key` posé, `aisle_pinned = true` (un renommage ne le reclasse
 * plus), et la correction est mémorisée pour l'utilisateur connecté, par libellé normalisé complet (upsert ;
 * `user_id` posé par la base). Seule écriture de `aisle_key` hors classifyAisle (liste blanche du test
 * d'architecture). Libellé sans forme normalisée exploitable (vide, ou plus de 80 caractères une fois
 * normalisé) : l'article bouge, rien n'est mémorisé. Nouvelle correction au-delà de MAX_AISLE_OVERRIDES →
 * aisle_overrides_full, rien n'est écrit ; modifier une correction existante reste permis.
 * Article inconnu, d'un autre workspace, ou rayon inconnu → invalid_params. Un `rev` de plus.
 */
export async function moveItemToAisle(
  workspaceId: string,
  itemId: string,
  aisleKey: string,
  tx: UserTx,
): Promise<MovedItem> {
  const workspace = parseWorkspace(workspaceId);
  const id = parseItemId(itemId);
  if (!isAisleKey(aisleKey)) throw new ShoppingError("invalid_params");
  const listId = await findListId(workspace, tx);

  await lockList(listId, tx);
  const [current] = await tx
    .select({ label: shoppingItems.label })
    .from(shoppingItems)
    .where(itemScope(workspace, listId, id))
    .for("update");
  if (!current) throw new ShoppingError("invalid_params");

  const { normalized } = normalizeLabel(current.label);
  if (normalized.length > 0 && [...normalized].length <= MAX_LABEL_LENGTH) {
    // La RLS limite ces deux lectures aux lignes de l'utilisateur connecté.
    const [known] = await tx
      .select({ id: shoppingAisleOverrides.id })
      .from(shoppingAisleOverrides)
      .where(
        and(
          eq(shoppingAisleOverrides.workspaceId, workspace),
          eq(shoppingAisleOverrides.keyword, normalized),
        ),
      );
    if (!known) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(shoppingAisleOverrides)
        .where(eq(shoppingAisleOverrides.workspaceId, workspace));
      if (count >= MAX_AISLE_OVERRIDES) {
        throw new ShoppingError("aisle_overrides_full");
      }
    }
    await tx.execute(sql`
      insert into ${shoppingAisleOverrides} (workspace_id, keyword, aisle_key)
      values (${workspace}, ${normalized}, ${aisleKey})
      on conflict (workspace_id, user_id, keyword)
      do update set aisle_key = excluded.aisle_key`);
  }

  await tx
    .update(shoppingItems)
    .set({ aisleKey, aislePinned: true })
    .where(itemScope(workspace, listId, id));
  return { id, aisleKey, rev: await bumpRev(workspace, listId, tx) };
}

/**
 * Mémorise l'ordre des rayons de l'utilisateur connecté : permutation exacte des 12 clés (ni doublon, ni clé
 * inconnue ou manquante) sinon invalid_params. Un seul upsert atomique par (workspace, utilisateur) : ni
 * lockList (aucune donnée de la liste ne change) ni `rev` (préférence personnelle, les autres membres ne
 * voient pas l'ordre de celui-ci). Renvoie l'ordre enregistré.
 */
export async function setAisleOrder(
  workspaceId: string,
  order: readonly string[],
  tx: UserTx,
): Promise<AisleKey[]> {
  const workspace = parseWorkspace(workspaceId);
  if (
    !Array.isArray(order) ||
    order.length !== AISLE_KEYS.length ||
    !order.every(isAisleKey) ||
    new Set(order).size !== AISLE_KEYS.length
  ) {
    throw new ShoppingError("invalid_params");
  }
  const keys = order as AisleKey[];
  await tx.execute(sql`
    insert into ${shoppingAisleOrder} (workspace_id, aisle_keys)
    values (${workspace}, array[${sql.join(
      keys.map((k) => sql`${k}`),
      sql`, `,
    )}]::text[])
    on conflict (workspace_id, user_id)
    do update set aisle_keys = excluded.aisle_keys`);
  return keys;
}
