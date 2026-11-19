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

/**
 * Placement des popups de pastille (Espace, Date, Tags) : sous la pastille, à 16 px au moins des bords
 * latéraux et du haut (à 390 px, la popup Date débordait à droite). En bas, la marge par défaut de Base UI
 * (5 px) : à 16 px, la popup Espace n'a plus la place sous la pastille du tiroir et se retourne. Le
 * retournement vers le haut reste le repli quand la place manque (Date et Tags dans le tiroir, clavier ouvert).
 * raccourci: Date et Tags couvrent encore le champ titre du tiroir à 390 px (≈ 90 px sous les pastilles) —
 * à revoir avec Antoine (popup ancrée au-dessus du champ titre, ou feuille dédiée sur mobile).
 */
export const chipPositionerProps = {
  side: "bottom",
  sideOffset: 8,
  align: "start",
  collisionPadding: { top: 16, right: 16, bottom: 5, left: 16 },
} as const;

/** Élément de liste d'une popup (choix, raccourci, tag) : 44 px, piste au survol et en surbrillance. */
export const chipItemClass =
  "flex min-h-11 w-full cursor-default items-center gap-2.5 rounded-md px-3 text-left text-body font-semibold text-foreground outline-none select-none hover:bg-pill-track data-highlighted:bg-pill-track data-highlighted:ring-2 data-highlighted:ring-ring data-highlighted:ring-inset disabled:cursor-not-allowed disabled:opacity-60";
