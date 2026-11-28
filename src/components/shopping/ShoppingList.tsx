"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Écran Courses (spec listes, « Courses ») : rayons non vides dans l'ordre de l'utilisateur (déjà triés par la
// lecture, `getShoppingList`), colonne bornée (`max-w-3xl`) comme la liste des tâches, une colonne à toutes les
// largeurs (repli sous 768 px sans objet). État vide : une tuile de verre (icône, phrase).
// Cocher d'un tap, optimiste (exception de frontend.md à valider à la spec : « un tap coche »). `useOptimistic`
// pose la coche et la descente en bas du rayon dans le geste, avant tout `await` ; le rendu serveur
// (`refresh()` de l'action) apporte l'état enregistré. Échec (refus, panne, pare-feu : `settleAction`) : retour
// à l'état d'avant et « Pas enregistré, réessaie » sous la ligne. Un article n'a jamais deux appels en vol.
// Ordre des rayons : `AisleSortable` (tâche 14), poignée dans l'en-tête de chaque rayon.
// Emplacement `quickAdd` : le champ d'ajout rapide (tâche 13), sous les rayons.
import { ShoppingBasket } from "lucide-react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  checkShoppingItem,
  uncheckShoppingItem,
} from "@/app/(app)/lists/shopping/actions";
import { settleAction } from "@/lib/settle-action";
import type { AisleGroup, ShoppingItem } from "@/modules/shopping/list-view";

import { AisleSection } from "./AisleSection";
import { AisleSortable } from "./AisleSortable";

type Toggle = { itemId: string; checked: boolean };

/**
 * Applique un tap à la liste affichée. Coché : en bas de son rayon (derniers cochés, date de cochage = maintenant).
 * Décoché : remonte parmi les non cochés.
 * raccourci: un article décoché se place en dernier des non cochés, pas à sa place d'ajout (la date d'ajout n'est
 * pas dans la lecture) — le rendu serveur le remet à sa place dès qu'il arrive ; ajouter la date si le saut gêne.
 */
function applyToggle(
  aisles: readonly AisleGroup[],
  { itemId, checked }: Toggle,
): AisleGroup[] {
  return aisles.map((aisle) => {
    if (!aisle.items.some((i) => i.id === itemId)) return aisle;
    const items = aisle.items.map((i) =>
      i.id === itemId ? { ...i, checkedAt: checked ? new Date() : null } : i,
    );
    return {
      ...aisle,
      items: [
        ...items.filter((i) => i.checkedAt === null),
        ...items
          .filter((i) => i.checkedAt !== null)
          .sort((a, b) => a.checkedAt!.getTime() - b.checkedAt!.getTime()),
      ],
    };
  });
}

type ShoppingListProps = {
  aisles: AisleGroup[];
  /** Champ d'ajout rapide (tâche 13). */
  quickAdd?: React.ReactNode;
};

export function ShoppingList({ aisles, quickAdd }: ShoppingListProps) {
  const t = useTranslations("shopping.list");
  const [shown, applyOptimistic] = useOptimistic(aisles, applyToggle);
  const [, startTransition] = useTransition();
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  function toggle(item: ShoppingItem) {
    if (inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    const checked = item.checkedAt === null;
    setFailedIds((ids) => without(ids, item.id));
    startTransition(async () => {
      applyOptimistic({ itemId: item.id, checked });
      const outcome = await settleAction(() =>
        checked ? checkShoppingItem(item.id) : uncheckShoppingItem(item.id),
      );
      inFlight.current.delete(item.id);
      if (outcome.ok && outcome.value.ok) return;
      // Après un `await`, une mise à jour sort de la transition : remise dedans (gotchas).
      startTransition(() => setFailedIds((ids) => new Set(ids).add(item.id)));
    });
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-grid">
      {shown.length === 0 ? (
        <section className="glass flex w-full flex-col items-start gap-3 rounded-tile p-tile">
          <span className="flex size-11 items-center justify-center rounded-lg bg-row text-link">
            <ShoppingBasket
              aria-hidden="true"
              className="size-5.5"
              strokeWidth={2}
            />
          </span>
          <p className="max-w-prose text-body text-foreground">{t("empty")}</p>
        </section>
      ) : (
        <AisleSortable
          aisles={shown}
          renderAisle={(aisle, handle) => (
            <AisleSection
              aisle={aisle}
              failedIds={failedIds}
              onToggle={toggle}
              handle={handle}
            />
          )}
        />
      )}
      {quickAdd}
    </div>
  );
}

function without(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}
