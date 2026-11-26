import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import type { CardState } from "@/components/kanban/SortableBoard";
import { getUserTimeZone } from "@/modules/core/time-zone";
import type { Task } from "@/modules/tasks/queries";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";
import { TaskCard } from "./TaskCard";

const TODAY = "2026-11-26";
const IN_PLACE: CardState = { dragging: false, overlay: false };

function renderCard(
  overrides: Partial<Task>,
  options: {
    locale?: "fr" | "en";
    showContext?: boolean;
    state?: CardState;
  } = {},
) {
  const { locale = "fr", showContext = true, state = IN_PLACE } = options;
  const task = buildTask(overrides);
  const { container } = render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone={getUserTimeZone()}
    >
      <TaskCard
        task={task}
        today={TODAY}
        showContext={showContext}
        state={state}
      />
    </NextIntlClientProvider>,
  );
  const card = container.firstElementChild as HTMLElement;
  return {
    task,
    card,
    legend: card.querySelector<HTMLElement>("[data-card-legend]"),
  };
}

function classes(element: Element) {
  return element.className.split(/\s+/);
}

/** Compteur de sous-tâches : l'élément qui porte l'icône de liste. */
function counterOf(card: HTMLElement) {
  return card.querySelector("svg.lucide-list-checks")!
    .parentElement as HTMLElement;
}

describe("carte d'une tâche du tableau", () => {
  it("porte le titre de la tâche et son repère, sur une surface opaque bordée à ombre légère", () => {
    const { task, card } = renderCard({ title: "Rappeler le plombier" });

    expect(card.getAttribute("data-task-card")).toBe(task.id);
    expect(classes(card)).toEqual(
      expect.arrayContaining([
        "rounded-lg",
        "border",
        "border-border",
        "bg-popover",
        "shadow-raised",
      ]),
    );
    const title = within(card).getByText("Rappeler le plombier");
    expect(classes(title)).toContain("line-clamp-2");
    expect(classes(title)).not.toContain("text-muted-foreground");
  });

  it("sous-tâche : le titre de sa parente ouvre la légende, tronqué sur une ligne, avec l'icône de retour et son libellé lu", () => {
    const { legend } = renderCard({
      parentId: "00000000-0000-4000-8000-00000000aaaa",
      parentTitle: "Refaire la salle de bain",
      contextName: "Maison",
      contextColor: "warm",
    });

    const parent = legend!.firstElementChild as HTMLElement;
    expect(parent.querySelector("svg.lucide-corner-down-right")).not.toBeNull();
    expect(
      classes(within(parent).getByText("Sous-tâche de")).includes("sr-only"),
    ).toBe(true);
    expect(
      classes(within(parent).getByText("Refaire la salle de bain")),
    ).toContain("truncate");
  });

  it("parente ouverte avec 2 sous-tâches ouvertes sur 3 : compteur « 1/3 » à l'encre, sans mention", () => {
    const { card } = renderCard({
      subtaskTotal: 3,
      subtaskDone: 1,
      subtaskOpen: 2,
    });

    const counter = counterOf(card);
    expect(within(counter).getByText("1/3")).toBeDefined();
    expect(classes(counter)).toContain("text-foreground");
    expect(
      within(counter).getByText("1 sous-tâche terminée sur 3"),
    ).toBeDefined();
    expect(within(card).queryByText("2 ouvertes")).toBeNull();
  });

  it("parente terminée avec 2 sous-tâches ouvertes : mention « 2 ouvertes » en clair et libellé complet lu", () => {
    const { card } = renderCard({
      statusCategory: "completed",
      completedAt: new Date("2026-11-25T10:00:00Z"),
      subtaskTotal: 3,
      subtaskDone: 1,
      subtaskOpen: 2,
    });

    const counter = counterOf(card);
    expect(classes(counter)).toContain("text-foreground");
    const mention = within(counter).getByText("2 ouvertes");
    expect(mention.closest("[aria-hidden='true']")).not.toBeNull();
    const label = within(counter).getByText(
      "1 sous-tâche terminée sur 3, 2 encore ouvertes",
    );
    expect(classes(label)).toContain("sr-only");
  });

  it("parente annulée avec 1 sous-tâche ouverte : mention au singulier", () => {
    const { card } = renderCard({
      statusCategory: "canceled",
      subtaskTotal: 1,
      subtaskDone: 0,
      subtaskOpen: 1,
    });

    expect(within(card).getByText("1 ouverte")).toBeDefined();
  });

  it("sous-tâches toutes terminées : compteur en texte secondaire, sans mention", () => {
    const { card } = renderCard({
      subtaskTotal: 2,
      subtaskDone: 2,
      subtaskOpen: 0,
    });

    const counter = counterOf(card);
    expect(within(counter).getByText("2/2")).toBeDefined();
    expect(classes(counter)).not.toContain("text-foreground");
    expect(within(card).queryByText(/ouverte/)).toBeNull();
  });

  it("tâche bloquée : pastille « Bloquée » bordée, à l'encre, avec son icône", () => {
    const { legend } = renderCard({ blocked: true });

    const chip = within(legend!).getByText("Bloquée");
    expect(classes(chip)).toEqual(
      expect.arrayContaining([
        "rounded-full",
        "border",
        "border-input",
        "text-foreground",
      ]),
    );
    expect(chip.querySelector("svg.lucide-ban")).not.toBeNull();
  });

  it("tâche ouverte en retard : échéance en braise, « En retard » lu", () => {
    const { legend } = renderCard({ dueDate: "2026-11-20" });

    const overdue = within(legend!).getByText("En retard");
    expect(classes(overdue)).toContain("sr-only");
    expect(overdue.closest(".text-destructive")).not.toBeNull();
    expect(overdue.parentElement!.textContent).toContain("20 nov.");
  });

  it("tâche terminée à l'échéance passée : ni braise ni « En retard »", () => {
    const { legend } = renderCard({
      statusCategory: "completed",
      dueDate: "2026-11-20",
    });

    expect(within(legend!).queryByText("En retard")).toBeNull();
    expect(legend!.querySelector(".text-destructive")).toBeNull();
    expect(legend!.textContent).toContain("20 nov.");
  });

  it("échéance du jour : « Aujourd'hui » à la place de la date", () => {
    const { legend } = renderCard({ dueDate: TODAY });

    expect(within(legend!).getByText("Aujourd'hui")).toBeDefined();
  });

  it("échéance du jour : à l'encre sur une tâche ouverte, en texte secondaire sur une tâche fermée", () => {
    const open = renderCard({ dueDate: TODAY });
    const closed = renderCard({ dueDate: TODAY, statusCategory: "completed" });

    expect(classes(within(open.legend!).getByText("Aujourd'hui"))).toContain(
      "text-foreground",
    );
    expect(
      classes(within(closed.legend!).getByText("Aujourd'hui")),
    ).not.toContain("text-foreground");
  });

  it("tâche ouverte : titre et légende en pleine couleur", () => {
    const { legend } = renderCard({
      contextName: "Maison",
      contextColor: "warm",
    });

    expect(classes(legend!)).not.toContain("grayscale");
  });

  it.each(["completed", "canceled"] as const)(
    "tâche fermée (%s) : titre atténué et légende grise, sans opacité",
    (statusCategory) => {
      const { card, legend } = renderCard({
        title: "Payer la facture",
        statusCategory,
        priority: 1,
        contextName: "Maison",
        contextColor: "warm",
      });

      expect(classes(within(card).getByText("Payer la facture"))).toContain(
        "text-muted-foreground",
      );
      expect(classes(legend!)).toContain("grayscale");
      // Badge et pastille sont dans la légende : ils perdent leurs couleurs avec elle.
      expect(
        legend!.querySelector("svg.lucide-square-exclamation-point"),
      ).not.toBeNull();
      expect(within(legend!).getByText("Maison")).toBeDefined();
      expect(card.className).not.toMatch(/opacity/);
    },
  );

  it("sans information : aucune légende", () => {
    const { card, legend } = renderCard({});

    expect(legend).toBeNull();
    expect(card.childElementCount).toBe(1);
  });

  it("montre la pastille d'espace à sa couleur, et les tags", () => {
    const { legend } = renderCard({
      contextName: "Nexxia",
      contextColor: "indigo",
      tags: ["devis", "urgent"],
    });

    expect(classes(within(legend!).getByText("Nexxia"))).toEqual(
      expect.arrayContaining(["bg-chip-indigo", "rounded-full"]),
    );
    expect(within(legend!).getByText("devis et urgent")).toBeDefined();
    expect(classes(within(legend!).getByText("Tags"))).toContain("sr-only");
  });

  it("`showContext` faux : pas de pastille d'espace", () => {
    const { card } = renderCard(
      { contextName: "Nexxia", contextColor: "indigo" },
      { showContext: false },
    );

    expect(within(card).queryByText("Nexxia")).toBeNull();
    expect(card.querySelector("[data-card-legend]")).toBeNull();
  });

  it("range la légende dans l'ordre : parente, Bloquée, espace, échéance, tags, compteur, priorité", () => {
    const { legend } = renderCard({
      parentId: "00000000-0000-4000-8000-00000000aaaa",
      parentTitle: "Parente",
      blocked: true,
      contextName: "Maison",
      contextColor: "warm",
      dueDate: "2026-12-03",
      tags: ["devis"],
      subtaskTotal: 2,
      subtaskDone: 1,
      subtaskOpen: 1,
      priority: 2,
    });

    const text = legend!.textContent!;
    const positions = [
      "Parente",
      "Bloquée",
      "Maison",
      "3 déc.",
      "devis",
      "1/2",
      "Priorité haute",
    ].map((part) => text.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("accroche le badge de priorité à la dernière information de la légende", () => {
    const { legend } = renderCard({
      dueDate: "2026-12-03",
      tags: ["devis"],
      priority: 2,
    });

    const group = legend!.querySelector("[data-legend-group]") as HTMLElement;
    expect(classes(group)).toContain("flex-nowrap");
    expect(within(group).getByText("devis")).toBeDefined();
    expect(within(group).getByText("Priorité haute")).toBeDefined();
    expect(within(group).queryByText("3 déc.")).toBeNull();
  });

  it("priorité seule : badge sans groupe", () => {
    const { legend } = renderCard({ priority: 4 });

    expect(within(legend!).getByText("Priorité basse")).toBeDefined();
    expect(legend!.querySelector("[data-legend-group]")).toBeNull();
  });

  it("s'affiche en anglais", () => {
    renderCard(
      {
        parentId: "00000000-0000-4000-8000-00000000aaaa",
        parentTitle: "Parent",
        statusCategory: "completed",
        dueDate: TODAY,
        tags: ["quote"],
        subtaskTotal: 3,
        subtaskDone: 1,
        subtaskOpen: 2,
        priority: 1,
      },
      { locale: "en" },
    );

    expect(screen.getByText("Subtask of")).toBeDefined();
    expect(screen.getByText("Today")).toBeDefined();
    expect(screen.getByText("2 open")).toBeDefined();
    expect(
      screen.getByText("1 subtask done out of 3, 2 still open"),
    ).toBeDefined();
    expect(screen.getByText("Urgent priority")).toBeDefined();
  });

  it("tâche bloquée et en retard, en anglais", () => {
    renderCard({ blocked: true, dueDate: "2026-11-20" }, { locale: "en" });

    expect(screen.getByText("Blocked")).toBeDefined();
    expect(screen.getByText("Overdue")).toBeDefined();
  });

  it("calque du glisser : même carte, sans repère ni ombre propre", () => {
    const { card } = renderCard(
      { title: "Portée" },
      { state: { dragging: true, overlay: true } },
    );

    expect(card.hasAttribute("data-task-card")).toBe(false);
    expect(classes(card)).toEqual(
      expect.arrayContaining(["border", "border-border", "bg-popover"]),
    );
    expect(classes(card)).not.toContain("shadow-raised");
    expect(within(card).getByText("Portée")).toBeDefined();
  });
});
