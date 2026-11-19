import { createCn } from "cn/config"

/** Tailles de texte de la charte (`@theme` de `src/app/globals.css`, DESIGN.md § 3). */
const CHARTER_TEXT_SIZES = [
  "display",
  "section",
  "page-title",
  "title",
  "figure",
  "stat",
  "brand",
  "lead",
  "body",
  "small",
  "caption",
  "eyebrow",
  "chip",
  "tab",
]

/**
 * `cn` du projet : sans cette déclaration, le moteur prend `text-small`,
 * `text-body`… pour des couleurs et en retire une sur deux.
 * Liste verrouillée contre globals.css par `utils.test.ts`.
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: CHARTER_TEXT_SIZES }] } },
})
