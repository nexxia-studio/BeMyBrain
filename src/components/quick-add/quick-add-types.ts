// Types d'ajout rapide (spec todo-unifiee, « Ajout rapide ») : un seul geste, plusieurs types déclarés ici.
// Tranche 1 : `task` seul, donc aucun sélecteur. Un module qui ajoute un type (dépense, article de courses)
// ajoute une entrée : la pilule de types apparaît d'elle-même à partir de deux.
import { ListChecks, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type QuickAddType = {
  /** Stable ; ses libellés sont `quickAdd.types.<key>.label` (sélecteur) et `.title` (nom du tiroir). */
  key: string;
  icon: LucideIcon;
  /** Formulaire du type, affiché sous le sélecteur. */
  Form: ComponentType;
  /** Action du registre (ADR-009) appelée par le formulaire. */
  action: string;
};

export const QUICK_ADD_TYPES: readonly QuickAddType[] = [
  {
    key: "task",
    icon: ListChecks,
    // raccourci: formulaire vide — remplacé par TaskQuickAddForm à la tâche 12 du plan todo-unifiee.
    Form: () => null,
    action: "tasks.create",
  },
];
