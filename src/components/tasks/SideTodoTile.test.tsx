import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TileCompactEmpty } from "@/components/bento/TileCompactEmpty";
import { tileClasses } from "@/components/bento/tile-sizes";
import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import { buildDashboard } from "@/modules/dashboard/tiles";
import { getUserTimeZone } from "@/modules/core/time-zone";
import type { Task } from "@/modules/tasks/queries";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

import {
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TINT_CLASSES,
} from "./priority-icons";
import { SideTodoTile } from "./SideTodoTile";

const TODAY = "2026-11-19";
const TRUSTUP = {
  id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b",
  name: "Trustup",
  color: "warm",
} as const;
const NEXXIA = {
  id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
  name: "Nexxia",
  color: "indigo",
} as const;

const proTodo = () => {
  const tile = buildDashboard({
    side: "pro",
    contexts: [TRUSTUP, NEXXIA],
    selected: [TRUSTUP.id, NEXXIA.id],
  }).tiles.find((t) => t.id === "proTodo");
  if (!tile) throw new Error("tuile proTodo absente du catalogue");
  return tile;
};

function renderTile(
  tasks: Task[] | null,
  { showContext = true, openQuickAdd = vi.fn() } = {},
) {
  render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <OpenQuickAddContext value={openQuickAdd}>
        <SideTodoTile
          tile={proTodo()}
          tasks={tasks}
          today={TODAY}
          showContext={showContext}
        />
      </OpenQuickAddContext>
    </NextIntlClientProvider>,
  );
  return { openQuickAdd };
}

const tile = () => screen.getByTestId("tile-proTodo");

afterEach(() => runAppAction.mockReset());

describe("tuile « To-do pro »", () => {
  it("5 prochaines du côté, case à cocher comprise, lien Tout voir vers /tasks", () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      buildTask({ side: "pro", title: `Pro ${i}`, dueDate: `2026-11-2${i}` }),
    );

    renderTile(tasks);

    const rows = within(
      within(tile()).getByRole("list", { name: "Prochaines tâches" }),
    ).getAllByRole("listitem");
    expect(
      rows.map((row) => within(row).getByRole("link").textContent),
    ).toEqual(
      ["Pro 0", "Pro 1", "Pro 2", "Pro 3", "Pro 4"].map((title) =>
        expect.stringContaining(title),
      ),
    );
    expect(within(rows[0]).getByRole("checkbox")).toBeTruthy();
    const seeAll = within(tile()).getByRole("link", { name: "Tout voir" });
    expect(seeAll.getAttribute("href")).toBe("/tasks");
  });

  it("5 lignes même avec des sous-tâches sans échéance parmi les tâches reçues", () => {
    const parent = buildTask({ side: "pro", title: "Parente" });
    const tasks = [
      parent,
      ...Array.from({ length: 3 }, (_, i) =>
        buildTask({
          side: "pro",
          title: `Sous ${i}`,
          parentId: parent.id,
          parentTitle: "Parente",
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        buildTask({ side: "pro", title: `Libre ${i}` }),
      ),
    ];

    renderTile(tasks);

    const rows = within(
      within(tile()).getByRole("list", { name: "Prochaines tâches" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(tile().textContent).not.toContain("Sous 0");
  });

  it("échéance passée écrite en braise ; espaces nommés quand il y a à distinguer", () => {
    renderTile([
      buildTask({
        side: "pro",
        title: "Relancer le devis",
        dueDate: "2026-11-17",
        contextName: "Trustup",
      }),
    ]);

    const link = within(tile()).getByRole("link", {
      name: /Relancer le devis/,
    });
    expect(within(link).getByText("17 nov.").className).toContain(
      "text-destructive",
    );
    expect(within(link).getByText("Trustup")).toBeTruthy();
  });

  it("priorité en badge teinté à icône dans la ligne de la tuile, rien pour 0", () => {
    renderTile([
      buildTask({ side: "pro", title: "Urgente du jour", priority: 1 }),
      buildTask({ side: "pro", title: "Ordinaire", priority: 0 }),
    ]);

    const urgent = within(tile()).getByRole("link", {
      name: /Urgente du jour/,
    });
    const badge = within(urgent).getByText("Priorité urgente").parentElement!;
    expect(badge.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        ...PRIORITY_BADGE_CLASSES.split(" "),
        ...PRIORITY_TINT_CLASSES[1].split(" "),
      ]),
    );
    expect(
      badge.querySelector("svg.lucide-square-exclamation-point"),
    ).not.toBeNull();
    const plain = within(tile()).getByRole("link", { name: /Ordinaire/ });
    expect(plain.querySelector("[class*='bg-priority-']")).toBeNull();
  });

  it("espaces nommés dans leur couleur : Trustup chip-warm, Nexxia chip-indigo", () => {
    renderTile([]);

    const spaces = within(tile()).getByRole("list", {
      name: "Espaces couverts",
    });
    const classes = (name: string) =>
      within(spaces).getByText(name).className.split(/\s+/);
    expect(classes("Trustup")).toContain("bg-chip-warm");
    expect(classes("Nexxia")).toContain("bg-chip-indigo");
  });

  it("vide, étirée par sa rangée : contenu en haut, bouton « Ajouter une tâche » poussé en bas", () => {
    renderTile([]);

    const add = within(tile()).getByRole("button", {
      name: messages.tasks.list.add,
    });
    const bottom = add.closest(".mt-auto");
    expect(bottom).not.toBeNull();
    expect(bottom?.parentElement?.classList.contains("grow")).toBe(true);
    expect(tile().dataset.tile).toBe("proTodo");
  });

  it.each([0, 2])(
    "%i tâche(s) : à la hauteur de son contenu, aucune classe de hauteur",
    (count) => {
      renderTile(
        Array.from({ length: count }, (_, i) =>
          buildTask({ side: "pro", title: `Pro ${i}` }),
        ),
      );

      for (const name of tileClasses("wide").split(" ")) {
        expect(tile().classList.contains(name)).toBe(true);
      }
      const classes = [tile(), ...tile().querySelectorAll("*")].flatMap(
        (element) => Array.from(element.classList),
      );
      expect(
        classes.filter(
          (name) => /(^|:)(min-|max-)?h-/.test(name) && name !== "min-h-11",
        ),
      ).toEqual([]);
    },
  );

  it("2 tâches : l'action est le lien « Tout voir » de l'en-tête, rien n'est poussé en bas", () => {
    renderTile(
      Array.from({ length: 2 }, (_, i) =>
        buildTask({ side: "pro", title: `Pro ${i}` }),
      ),
    );

    const classes = [tile(), ...tile().querySelectorAll("*")].flatMap(
      (element) => Array.from(element.classList),
    );
    expect(classes).not.toContain("mt-auto");
  });

  it("une ligne de la tuile tient sur une ligne : titre tronqué, légende et espaces sans retour à la ligne", () => {
    const title =
      "Préparer la présentation du projet pour le comité de direction";
    renderTile([
      buildTask({
        side: "pro",
        title,
        dueDate: "2026-11-20",
        dueTime: "09:30",
        contextName: "Nexxia",
        contextColor: "indigo",
      }),
    ]);

    const link = within(tile()).getByRole("link", { name: new RegExp(title) });
    const titleSpan = within(link).getByText(title);
    const legend = within(link).getByText("09:30").parentElement;
    const spaces = within(tile()).getByRole("list", {
      name: "Espaces couverts",
    });
    expect(titleSpan.classList.contains("truncate")).toBe(true);
    expect(titleSpan.classList.contains("line-clamp-2")).toBe(false);
    expect(legend?.classList.contains("flex-nowrap")).toBe(true);
    // Coupée au bord en largeur seulement (`overflow-x-clip`) : le badge de priorité n'est pas rogné en hauteur.
    expect(legend?.classList.contains("overflow-x-clip")).toBe(true);
    expect(spaces.classList.contains("flex-nowrap")).toBe(true);
    expect(spaces.classList.contains("overflow-hidden")).toBe(true);
  });

  it.each([1, 2, 4])(
    "%i tâche(s) sur 5 : aucun état de remplissage sous les lignes",
    (count) => {
      renderTile(
        Array.from({ length: count }, (_, i) =>
          buildTask({ side: "pro", title: `Pro ${i}` }),
        ),
      );

      expect(within(tile()).queryByTestId("tile-rest")).toBeNull();
      expect(tile().textContent).not.toContain("Rien d'autre à venir.");
    },
  );

  it("vide : l'état vide compact de TileCompactEmpty, le même texte que le givre de chargement", () => {
    renderTile([]);
    const real = tile().querySelector("section")?.textContent;

    const shared = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <TileCompactEmpty tile={proTodo()} />
      </NextIntlClientProvider>,
    ).container.textContent;

    expect(real).toBe(shared);
  });

  it("vide : dit à quoi sert la tuile et propose d'ajouter une tâche", () => {
    const { openQuickAdd } = renderTile([]);

    expect(tile().textContent).toContain(messages.dashboard.tiles.proTodo.body);
    fireEvent.click(
      within(tile()).getByRole("button", { name: "Ajouter une tâche" }),
    );
    expect(openQuickAdd).toHaveBeenCalledOnce();
  });

  it("lecture en échec : message d'erreur, titre et lien restent", () => {
    renderTile(null);

    expect(within(tile()).getByRole("status").textContent).toBe(
      messages.dashboard.tiles.tasksError,
    );
    expect(tile().textContent).toContain(
      messages.dashboard.tiles.proTodo.title,
    );
    expect(
      within(tile()).queryByRole("list", { name: "Prochaines tâches" }),
    ).toBeNull();
  });
});
