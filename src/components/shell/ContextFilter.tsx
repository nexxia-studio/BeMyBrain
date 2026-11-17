"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Filtre d'espace de la barre latérale (ordinateur, ≥ 1024 px ; DESIGN.md § 5) : « tous » ou un seul
// espace du côté actif, Privé ou Pro (BRAIN-30, lus en base, jamais en dur). Sous 1024 px, c'est la
// pastille de l'en-tête de page qui filtre (ContextFilterMenu).
// Liste verticale plutôt que pilules qui passent à la ligne : à 212 px utiles, les noms saisis
// (longueur libre, nombre libre) restent alignés et lisibles sans retour à la ligne irrégulier.
// Piste sans verre : la barre latérale en est déjà (jamais de verre sur du verre, DESIGN.md § 8 déc. 6).
// Changement instantané (geste répété, ADR-006), Motion pour la pression seulement.
import { useTranslations } from "next-intl";

import { setContextSelection } from "@/lib/preferences-actions";
import type { Side } from "@/modules/core/schemas";

import { PillButton } from "./PillButton";
import { PreferenceStatus } from "./PreferenceStatus";
import { useOptimisticPreference } from "./use-optimistic-preference";

type ContextOption = {
  id: string;
  /** Saisi par l'utilisateur : affiché tel quel, jamais traduit. */
  name: string;
};

type ContextFilterProps = {
  /** Côté actif : la sélection est mémorisée par côté. */
  side: Side;
  contexts: ContextOption[];
  /** Espaces retenus (lus dans bmb_contexts_<côté> par le serveur) ; tous = aucun filtre. */
  selected: string[];
};

export function ContextFilter({ side, contexts, selected }: ContextFilterProps) {
  const t = useTranslations("shell.contexts");
  const allIds = contexts.map((context) => context.id);
  const { shown, pending, failed, update } = useOptimisticPreference(
    selected,
    (ids: string[]) =>
      setContextSelection(side, ids.length === allIds.length ? null : ids),
  );
  const all = shown.length === contexts.length;

  return (
    <div className="relative">
      <div
        role="group"
        aria-label={t("label")}
        aria-busy={pending}
        className="flex flex-col gap-1 rounded-lg bg-pill-track p-1"
      >
        <PillButton
          active={all}
          onPress={() => !all && update(allIds)}
          className="rounded-md px-3 text-left"
        >
          {t("all", { count: contexts.length })}
        </PillButton>
        {contexts.map((context) => {
          const active = !all && shown.includes(context.id);
          return (
            <PillButton
              key={context.id}
              active={active}
              onPress={() => !active && update([context.id])}
              className="rounded-md px-3 text-left break-words"
            >
              {context.name}
            </PillButton>
          );
        })}
      </div>
      <PreferenceStatus failed={failed} className="left-0" />
    </div>
  );
}
