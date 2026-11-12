"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Filtre des contextes Pro (Trustup, Nexxia… lus en base, jamais en dur) : « tous » ou un seul.
// Même dessin que la pilule de bascule ; changement instantané (geste répété, ADR-006), Motion pour la
// pression seulement.
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";

import { setContextSelection } from "@/lib/preferences-actions";
import { PillButton } from "./PillButton";

type ContextOption = {
  id: string;
  /** Saisi par l'utilisateur : affiché tel quel, jamais traduit. */
  name: string;
};

type ContextFilterProps = {
  contexts: ContextOption[];
  /** Contextes retenus (lus dans bmb_contexts par le serveur) ; tous = aucun filtre. */
  selected: string[];
};

export function ContextFilter({ contexts, selected }: ContextFilterProps) {
  const t = useTranslations("shell.contexts");
  const [shown, setShown] = useOptimistic(selected);
  const [pending, startTransition] = useTransition();
  const all = shown.length === contexts.length;

  function choose(ids: string[] | null) {
    startTransition(async () => {
      setShown(ids ?? contexts.map((context) => context.id));
      await setContextSelection(ids);
    });
  }

  // Posé sur du verre : sur le fond nu, le texte inactif tombe sous 4,5:1 près du halo bleu (DESIGN.md
  // § 8, décision 6, mesuré sur capture).
  return (
    <div className="glass w-fit rounded-full">
      <div
        role="group"
        aria-label={t("label")}
        aria-busy={pending}
        className="flex flex-wrap gap-1 rounded-full bg-pill-track p-1"
      >
        <PillButton active={all} onPress={() => !all && choose(null)}>
          {t("all", { count: contexts.length })}
        </PillButton>
        {contexts.map((context) => {
          const active = !all && shown.includes(context.id);
          return (
            <PillButton
              key={context.id}
              active={active}
              onPress={() => !active && choose([context.id])}
            >
              {context.name}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}
