// Pastilles d'un tap de l'ajout rapide (Espace, Date, Tags) : bouton secondaire pilule (DESIGN.md § 5,
// **Boutons**), 44 px de haut. Valeur choisie en encre, pastille vide en encre secondaire (sur `popover`
// blanc : 6,83:1). Désactivée pendant l'appel : opacité 60 %.
export const chipTriggerClass =
  "flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary px-3.5 text-small font-semibold disabled:cursor-not-allowed disabled:opacity-60";

/** Popup d'une pastille : opaque (`popover`, jamais de verre sur du verre), au-dessus du tiroir. */
export const chipPopupClass =
  "max-h-(--available-height) min-w-56 overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-popover-foreground shadow-glass outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";

/** Positionneur : même calque que le tiroir, monté après lui, donc au-dessus. */
export const chipPositionerClass = "z-(--z-dialog) outline-none";

/** Élément de liste d'une popup (choix, raccourci, tag) : 44 px, piste au survol et en surbrillance. */
export const chipItemClass =
  "flex min-h-11 w-full cursor-default items-center gap-2.5 rounded-md px-3 text-left text-body font-semibold text-foreground outline-none select-none hover:bg-pill-track data-highlighted:bg-pill-track data-highlighted:ring-2 data-highlighted:ring-ring data-highlighted:ring-inset disabled:cursor-not-allowed disabled:opacity-60";
