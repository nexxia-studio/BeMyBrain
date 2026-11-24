// Habillages de la démo du kanban (D7 de demo-plan.md), à comparer par le sélecteur « Cartes ». Tokens de DESIGN.md
// seulement ; dans les deux, la carte est opaque (`popover`) à fin contour `border`, sur un creux `pill-track`.
// - `well` (A, défaut) : la colonne entière est le creux, posée à nu sur la brume, sans verre ni ombre ; les cartes
//   portent `shadow-raised`. Fond nu : l'en-tête passe à l'encre (texte secondaire interdit sur le cœur d'un halo,
//   3,51:1 sur `pill-track` ; encre 8,29:1, lien « Tout voir » 4,75:1).
// - `glass` (B) : la colonne reste une tuile de verre (en-tête secondaire ≥ 5,50:1) ; le creux est un cadre teinté
//   à l'intérieur, sous les cartes, qui restent à plat (aucune ombre : le verre porte déjà la sienne).
// Aucun texte ne se pose sur le creux de B. Jamais deux verres empilés.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import type { BoardSurface } from "@/components/kanban/SortableBoard";

export type DemoLook = "well" | "glass";

export const DEMO_LOOKS: Record<
  DemoLook,
  { board: BoardSurface; cardShadow: string | undefined }
> = {
  well: {
    board: { column: "bg-pill-track", heading: "text-foreground" },
    cardShadow: "shadow-raised",
  },
  glass: {
    board: { column: "glass", well: "rounded-lg bg-pill-track p-2" },
    cardShadow: undefined,
  },
};

/** Ordre des blocs du détail (D9) : le nouveau, ou celui d'avant pour comparer (sélecteur « Détail »). */
export type DemoDetailLayout = "new" | "current";
