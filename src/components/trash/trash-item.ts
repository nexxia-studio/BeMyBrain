import type { ReactNode } from "react";

/** Action du registre (ADR-009) qui restaure un élément, avec ses paramètres (sérialisables). */
export type TrashRestore = { action: string; params: Record<string, string> };

/**
 * Élément de la corbeille, quel que soit son type : lu et rendu côté serveur par le type déclaré
 * (`trash-types.tsx`), affiché par `TrashList` (client) avec la date et « Restaurer ».
 */
export type TrashItem = {
  /** Unique dans la corbeille : `<type>:<id>`. */
  key: string;
  deletedAt: Date;
  restore: TrashRestore;
  /** Contenu propre au type (titre, légende), sans contrôle. */
  row: ReactNode;
};
