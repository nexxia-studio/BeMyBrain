import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TINT_CLASSES,
  type PriorityLevel,
} from "./priority-icons";
import { PriorityBadge } from "./PriorityBadge";

function renderBadge(priority: number, locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <PriorityBadge priority={priority} />
    </NextIntlClientProvider>,
  );
}

const LEVELS: readonly [PriorityLevel, string, string, string][] = [
  [1, "lucide-square-exclamation-point", "Priorité urgente", "Urgent priority"],
  [2, "lucide-signal-high", "Priorité haute", "High priority"],
  [3, "lucide-signal-medium", "Priorité moyenne", "Medium priority"],
  [4, "lucide-signal-low", "Priorité basse", "Low priority"],
];

describe("badge de priorité", () => {
  it.each(LEVELS)(
    "niveau %i : forme du badge, teinte du niveau, icône 16 px cachée, libellé lu",
    (level, icon, label) => {
      const { container } = renderBadge(level);

      const badge = container.firstElementChild as HTMLElement;
      const classes = badge.className.split(/\s+/);
      expect(classes).toEqual(
        expect.arrayContaining([
          ...PRIORITY_BADGE_CLASSES.split(" "),
          ...PRIORITY_TINT_CLASSES[level].split(" "),
        ]),
      );
      // Place de 16 px dans la légende (celle de l'icône remplacée) : lignes et cartes gardent leur hauteur.
      expect(classes).toContain("-my-0.5");
      const svg = badge.querySelector(`svg.${icon}`)!;
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.classList.contains("size-4")).toBe(true);
      // L'icône prend l'encre de la teinte (couleur du badge), jamais l'encre ordinaire.
      expect(svg.classList.contains("text-foreground")).toBe(false);
      const text = screen.getByText(label);
      expect(text.classList.contains("sr-only")).toBe(true);
      expect(badge.contains(text)).toBe(true);
    },
  );

  it.each(LEVELS)(
    "niveau %i : libellé en anglais",
    (level, _icon, _fr, label) => {
      renderBadge(level, "en");

      expect(screen.getByText(label).classList.contains("sr-only")).toBe(true);
    },
  );

  it("rien pour la priorité 0, ni pour une valeur hors de 1 à 4", () => {
    expect(renderBadge(0).container.innerHTML).toBe("");
    expect(renderBadge(5).container.innerHTML).toBe("");
  });
});
