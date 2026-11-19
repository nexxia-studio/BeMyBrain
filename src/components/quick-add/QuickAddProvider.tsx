"use client";

// Ajout rapide de la coque : état d'ouverture, dernier type utilisé (retenu tant que la coque est montée,
// c'est-à-dire pour la session de l'onglet), et fonction d'ouverture partagée avec les déclencheurs
// (« + » de la barre d'onglets, bouton d'ajout rond de l'en-tête).
import { useCallback, useState } from "react";

import { QuickAdd } from "./QuickAdd";
import { OpenQuickAddContext } from "./quick-add-context";
import { QUICK_ADD_TYPES, type QuickAddType } from "./quick-add-types";

type QuickAddProviderProps = {
  children: React.ReactNode;
  /** Types déclarés ; à remplacer seulement dans les tests. */
  types?: readonly QuickAddType[];
};

export function QuickAddProvider({
  children,
  types = QUICK_ADD_TYPES,
}: QuickAddProviderProps) {
  const [open, setOpen] = useState(false);
  const [typeKey, setTypeKey] = useState(types[0].key);
  const openQuickAdd = useCallback(() => setOpen(true), []);

  return (
    <OpenQuickAddContext value={openQuickAdd}>
      {children}
      <QuickAdd
        open={open}
        onOpenChange={setOpen}
        types={types}
        typeKey={typeKey}
        onTypeChange={setTypeKey}
      />
    </OpenQuickAddContext>
  );
}
