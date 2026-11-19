// Types d'ajout rapide (spec todo-unifiee, « Ajout rapide ») : un seul geste, plusieurs types déclarés ici.
// Tranche 1 : `task` seul, donc aucun sélecteur. Un module qui ajoute un type (dépense, article de courses)
// ajoute une entrée : la pilule de types apparaît d'elle-même à partir de deux.
import { ListChecks, type LucideIcon } from "lucide-react";
import type { ComponentType, RefObject } from "react";

import { TaskQuickAddForm } from "@/components/tasks/TaskQuickAddForm";
import type { CurrentScope } from "@/lib/context-filter";

/** Côté et espace courants de la coque (bascule Privé / Pro, filtre d'espace), lus par le serveur. */
export type QuickAddScope = CurrentScope;

export type QuickAddFormProps = {
  scope: QuickAddScope;
  /** Champ qui reçoit le focus à l'ouverture (clavier ouvert d'office, même au toucher). */
  initialFocusRef: RefObject<HTMLInputElement | null>;
  /** Ferme l'ajout rapide (lien « Ouvrir » vers l'élément créé). */
  onClose: () => void;
};

export type QuickAddType = {
  /** Stable ; ses libellés sont `quickAdd.types.<key>.label` (sélecteur) et `.title` (nom du tiroir). */
  key: string;
  icon: LucideIcon;
  /** Formulaire du type, affiché sous le sélecteur. */
  Form: ComponentType<QuickAddFormProps>;
  /** Action du registre (ADR-009) appelée par le formulaire. */
  action: string;
};

export const QUICK_ADD_TYPES: readonly QuickAddType[] = [
  {
    key: "task",
    icon: ListChecks,
    Form: TaskQuickAddForm,
    action: "tasks.create",
  },
];
