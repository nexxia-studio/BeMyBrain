import {
  BriefcaseBusiness,
  HeartPulse,
  House,
  ListChecks,
  type LucideIcon,
  Megaphone,
  ReceiptText,
  ShoppingBasket,
  Wallet,
} from "lucide-react";

import type { TileId } from "@/modules/dashboard/tiles";

/** Icône Lucide de l'état vide de chaque tuile (DESIGN.md § 1 : trait 2, bouts arrondis). */
export const TILE_ICONS: Record<TileId, LucideIcon> = {
  privateTodo: ListChecks,
  shopping: ShoppingBasket,
  budget: Wallet,
  health: HeartPulse,
  home: House,
  proTodo: ListChecks,
  clients: BriefcaseBusiness,
  proFinances: ReceiptText,
  social: Megaphone,
};
