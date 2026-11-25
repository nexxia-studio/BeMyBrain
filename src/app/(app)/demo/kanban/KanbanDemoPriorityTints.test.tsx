import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { PRIORITY_TINT_CLASSES } from "@/components/tasks/priority-icons";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { KanbanDemoPriorityTints } from "./KanbanDemoPriorityTints";
import { KanbanDemoSettings } from "./KanbanDemoSettings";

function renderTints(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <KanbanDemoPriorityTints />
    </NextIntlClientProvider>,
  );
}

const SURFACES_FR = ["Carte", "Ligne de liste", "Colonne"];

describe("planche des teintes de priorité (démo)", () => {
  it("montre les quatre niveaux, en badge et en pastille, sur les trois surfaces", () => {
    renderTints();

    expect(screen.getByText("Teintes de priorité")).toBeDefined();
    for (const name of SURFACES_FR) {
      const surface = screen.getByRole("group", { name });
      for (const [level, label, full] of [
        [1, "Urgente", "Priorité urgente"],
        [2, "Haute", "Priorité haute"],
        [3, "Moyenne", "Priorité moyenne"],
        [4, "Basse", "Priorité basse"],
      ] as const) {
        const badge = within(surface).getByText(full).parentElement!;
        const pill = within(surface).getByText(label);
        for (const tinted of [badge, pill.parentElement!]) {
          expect(tinted.querySelector("svg")).not.toBeNull();
          for (const tint of PRIORITY_TINT_CLASSES[level].split(" ")) {
            expect(tinted.classList.contains(tint)).toBe(true);
          }
        }
      }
    }
  });

  it("pose une pastille d'espace de chaque couleur à côté, sur chaque surface", () => {
    renderTints();

    for (const name of SURFACES_FR) {
      const surface = screen.getByRole("group", { name });
      const chips = [...surface.querySelectorAll("[data-space-chip]")];

      expect(chips.map((chip) => chip.getAttribute("data-space-chip"))).toEqual(
        ["neutral", "warm", "indigo"],
      );
      expect(chips.map((chip) => chip.className)).toEqual([
        expect.stringContaining("bg-chip-neutral"),
        expect.stringContaining("bg-chip-warm"),
        expect.stringContaining("bg-chip-indigo"),
      ]);
    }
  });

  it("chaque surface porte son fond : carte blanche, ligne, colonne creusée", () => {
    renderTints();

    const classes = SURFACES_FR.map(
      (name) => screen.getByRole("group", { name }).className,
    );

    expect(classes[0]).toContain("bg-popover");
    expect(classes[1]).toContain("bg-row");
    expect(classes[2]).toContain("bg-pill-track");
  });

  it("s'affiche en anglais", () => {
    renderTints("en");

    expect(screen.getByText("Priority tints")).toBeDefined();
    for (const name of ["Card", "List row", "Column"]) {
      const surface = screen.getByRole("group", { name });
      for (const label of ["Urgent", "High", "Medium", "Low"]) {
        expect(within(surface).getByText(label)).toBeDefined();
      }
      expect(within(surface).getByText("Urgent priority")).toBeDefined();
    }
  });

  it("est rangée dans les réglages repliés de la démo, jamais au-dessus du tableau", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <KanbanDemoSettings
          latency={0}
          onLatencyChange={() => {}}
          failNext={false}
          onFailNextChange={() => {}}
          look="well"
          onLookChange={() => {}}
          pendingCount={0}
        />
      </NextIntlClientProvider>,
    );

    const details = screen.getByText("Teintes de priorité").closest("details");

    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
  });
});
