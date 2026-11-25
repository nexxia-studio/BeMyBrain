import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import { getUserTimeZone } from "@/modules/core/time-zone";
import type { Task } from "@/modules/tasks/queries";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));
const setContextSelection = vi.hoisted(() => vi.fn());
vi.mock("@/lib/preferences-actions", () => ({ setContextSelection }));

import {
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TINT_CLASSES,
} from "./priority-icons";
import {
  TASK_LIST_TILE_CLASSES,
  TASK_ROW_CLASSES,
  TASK_ROW_LEGEND_CLASSES,
  TASK_ROW_LEGEND_STRUT_CLASSES,
  TASK_ROW_LEGEND_TEXT,
  TASK_ROW_LINE_CLASSES,
  TASK_ROW_TEXT_CLASSES,
  TASK_ROW_TITLE_TEXT,
  TASK_ROWS_CLASSES,
  TASK_SECTION_CLASSES,
  TASK_SECTION_HEADER_CLASSES,
  TASK_SECTION_HEADING_TEXT,
} from "./task-list-layout";
import { TaskList } from "./TaskList";
import { TaskRow } from "./TaskRow";

function expectClasses(element: HTMLElement, classes: string) {
  expect(element.className.split(/\s+/)).toEqual(
    expect.arrayContaining(classes.split(" ")),
  );
}

const TODAY = "2026-11-19";
const PARENT_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function renderList(
  tasks: Task[],
  {
    filtered = false,
    showContext = true,
    openQuickAdd = vi.fn(),
    listQuery = "",
  } = {},
) {
  render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <OpenQuickAddContext value={openQuickAdd}>
        <TaskList
          tasks={tasks}
          today={TODAY}
          side="pro"
          filtered={filtered}
          showContext={showContext}
          listQuery={listQuery}
        />
      </OpenQuickAddContext>
    </NextIntlClientProvider>,
  );
  return { openQuickAdd };
}

const sectionTitles = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

afterEach(() => {
  runAppAction.mockReset();
  setContextSelection.mockReset();
});

describe("liste des tâches : sections", () => {
  it("range les tâches par échéance, sections vides omises", () => {
    renderList([
      buildTask({ title: "Plus tard", dueDate: "2026-12-01" }),
      buildTask({ title: "Sans date" }),
      buildTask({ title: "Hier", dueDate: "2026-11-18" }),
      buildTask({ title: "Demain", dueDate: "2026-11-20" }),
    ]);

    expect(sectionTitles()).toEqual([
      "En retard",
      "Demain",
      "Plus tard",
      "Sans échéance",
    ]);
    const overdue = screen.getByRole("region", { name: "En retard" });
    expect(within(overdue).getByRole("link", { name: /Hier/ })).toBeTruthy();
  });

  it("une seule tuile de verre bornée en largeur, titres de section en surtitre à côté de leur compteur", () => {
    renderList([
      buildTask({ title: "Hier", dueDate: "2026-11-18" }),
      buildTask({ title: "Demain", dueDate: "2026-11-20" }),
    ]);

    const tiles = document.querySelectorAll(".glass");
    const overdue = screen.getByRole("region", { name: "En retard" });
    const heading = within(overdue).getByRole("heading", { level: 2 });

    expect(tiles).toHaveLength(1);
    expect(tiles[0].classList.contains("max-w-3xl")).toBe(true);
    expect(overdue.classList.contains("glass")).toBe(false);
    expect(heading.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-eyebrow", "text-muted-foreground"]),
    );
    expect(heading.parentElement?.classList.contains("justify-between")).toBe(
      false,
    );
  });

  it("montre le compteur n/m sur la parente", () => {
    renderList([
      buildTask({
        title: "Préparer le salon",
        subtaskTotal: 3,
        subtaskDone: 1,
      }),
    ]);

    expect(screen.getByText("1/3")).toBeTruthy();
    expect(
      screen.getByText("1 sous-tâche terminée sur 3", { selector: ".sr-only" }),
    ).toBeTruthy();
  });

  it("sous-tâche avec échéance : ligne dans sa section, titre de la parente en légende ; sans échéance : aucune ligne", () => {
    renderList([
      buildTask({
        title: "Réserver la salle",
        parentId: PARENT_ID,
        parentTitle: "Préparer le salon",
        dueDate: TODAY,
      }),
      buildTask({
        title: "Imprimer les flyers",
        parentId: PARENT_ID,
        parentTitle: "Préparer le salon",
      }),
    ]);

    const today = screen.getByRole("region", { name: "Aujourd'hui" });
    expect(within(today).getByText("Réserver la salle")).toBeTruthy();
    expect(within(today).getByText("Préparer le salon")).toBeTruthy();
    expect(screen.queryByText("Imprimer les flyers")).toBeNull();
  });

  it("échéance en retard en braise, espace, tags et heure en légende, lien vers le détail", () => {
    const task = buildTask({
      title: "Relancer le devis",
      dueDate: "2026-11-17",
      dueTime: "14:00",
      contextName: "Trustup",
      tags: ["client"],
      priority: 1,
    });
    renderList([task]);

    const link = screen.getByRole("link", { name: /Relancer le devis/ });
    expect(link.getAttribute("href")).toBe(`/tasks/${task.id}`);
    expect(within(link).getByText("Trustup")).toBeTruthy();
    expect(within(link).getByText("client")).toBeTruthy();
    expect(within(link).getByText("14:00")).toBeTruthy();
    expect(within(link).getByText("Priorité urgente")).toBeTruthy();
    const due = within(link).getByText("17 nov.");
    expect(due.className).toContain("text-destructive");
  });
});

describe("liste des tâches : géométrie partagée avec le givre", () => {
  it("tuile, section, en-tête et ligne portent les classes de task-list-layout, lues aussi par le givre", () => {
    renderList([buildTask({ title: "Hier", dueDate: "2026-11-18" })]);

    const section = screen.getByRole("region", { name: "En retard" });
    const heading = within(section).getByRole("heading", { level: 2 });
    const item = within(section).getByRole("listitem");
    const row = item.firstElementChild as HTMLElement;
    const line = row.firstElementChild as HTMLElement;
    const text = within(section).getByRole("link");
    const [title, legend] = Array.from(text.children) as HTMLElement[];
    expectClasses(section.parentElement as HTMLElement, TASK_LIST_TILE_CLASSES);
    expectClasses(section, TASK_SECTION_CLASSES);
    expectClasses(
      heading.parentElement as HTMLElement,
      TASK_SECTION_HEADER_CLASSES,
    );
    expectClasses(heading, TASK_SECTION_HEADING_TEXT);
    expectClasses(item.parentElement as HTMLElement, TASK_ROWS_CLASSES);
    expectClasses(row, TASK_ROW_CLASSES);
    expectClasses(line, TASK_ROW_LINE_CLASSES);
    expectClasses(text, TASK_ROW_TEXT_CLASSES);
    expectClasses(title, TASK_ROW_TITLE_TEXT);
    expectClasses(legend, `${TASK_ROW_LEGEND_CLASSES} ${TASK_ROW_LEGEND_TEXT}`);
    const strut = legend.firstElementChild as HTMLElement;
    expectClasses(strut, TASK_ROW_LEGEND_STRUT_CLASSES);
    expect(strut.getAttribute("aria-hidden")).toBe("true");
    expect(strut.textContent).toBe("");
  });

  it("légende à la hauteur d'une pastille, avec ou sans pastille : même cale, même grille", () => {
    renderList([
      buildTask({
        title: "Avec",
        dueDate: "2026-11-18",
        contextName: "Nexxia",
      }),
      buildTask({ title: "Sans", dueDate: "2026-11-17", contextName: null }),
    ]);

    const legends = screen
      .getAllByRole("link")
      .map((link) => link.children[1] as HTMLElement);

    expect(legends).toHaveLength(2);
    for (const legend of legends) {
      expectClasses(legend, TASK_ROW_LEGEND_CLASSES);
      expectClasses(
        legend.firstElementChild as HTMLElement,
        TASK_ROW_LEGEND_STRUT_CLASSES,
      );
    }
    expect(within(legends[1]).getByText("Nexxia")).toBeTruthy();
  });

  it("ligne sans rien en légende : ni légende ni cale (la ligne garde sa hauteur de 44 px)", () => {
    renderList([buildTask({ title: "Rien" })], { showContext: false });

    const link = screen.getByRole("link", { name: /Rien/ });

    expect(link.children).toHaveLength(1);
  });
});

describe("liste des tâches : focus clavier", () => {
  it("le lien de la ligne suit le rayon de la ligne (rounded-lg), anneau de focus arrondi", () => {
    renderList([buildTask({ title: "Payer la crèche" })]);

    const link = screen.getByRole("link", { name: /Payer la crèche/ });

    expect(link.className.split(/\s+/)).toContain("rounded-lg");
  });
});

describe("liste des tâches : titre complet", () => {
  it("le titre passe sur deux lignes et la légende à la ligne (la ligne unique est réservée aux tuiles)", () => {
    renderList([buildTask({ title: "Payer la crèche", dueTime: "14:00" })]);

    const link = screen.getByRole("link", { name: /Payer la crèche/ });
    const title = within(link).getByText("Payer la crèche");
    const legend = within(link).getByText("14:00").parentElement;

    expect(title.classList.contains("line-clamp-2")).toBe(true);
    expect(title.classList.contains("truncate")).toBe(false);
    expect(legend?.classList.contains("flex-wrap")).toBe(true);
  });
});

describe("liste des tâches : tags", () => {
  it("tags séparés selon la langue (« client, maison et fête »)", () => {
    renderList([
      buildTask({ title: "Préparer", tags: ["client", "maison", "fête"] }),
    ]);

    const link = screen.getByRole("link", { name: /Préparer/ });

    expect(within(link).getByText("client, maison et fête")).toBeTruthy();
  });
});

describe("liste des tâches : priorité", () => {
  it("un badge teinté par niveau : forme du badge, teinte et icône du niveau (16 px), libellé lu inchangé", () => {
    renderList(
      [1, 2, 3, 4].map((priority) =>
        buildTask({ title: `Tâche ${priority}`, priority }),
      ),
    );

    const expected = [
      [1, "lucide-square-exclamation-point", "Priorité urgente"],
      [2, "lucide-signal-high", "Priorité haute"],
      [3, "lucide-signal-medium", "Priorité moyenne"],
      [4, "lucide-signal-low", "Priorité basse"],
    ] as const;
    for (const [priority, icon, label] of expected) {
      const link = screen.getByRole("link", {
        name: new RegExp(`Tâche ${priority}`),
      });
      const badge = within(link).getByText(label).parentElement!;
      expectClasses(badge, PRIORITY_BADGE_CLASSES);
      expectClasses(badge, PRIORITY_TINT_CLASSES[priority]);
      const svg = badge.querySelector(`svg.${icon}`);
      expect(svg?.getAttribute("class")).toContain("size-4");
      // L'icône prend l'encre de la teinte, plus l'encre ordinaire.
      expect(svg?.getAttribute("class")).not.toContain("text-foreground");
    }
  });

  it("priorité 2 : classe de teinte haute et icône de signal haute dans le badge", () => {
    renderList([buildTask({ title: "Haute", priority: 2 })]);

    const link = screen.getByRole("link", { name: /Haute/ });
    const badge = within(link).getByText("Priorité haute").parentElement!;

    expectClasses(
      badge,
      "bg-priority-high text-priority-high-foreground size-5 rounded-sm",
    );
    expect(badge.querySelector("svg.lucide-signal-high")).not.toBeNull();
  });

  it("accroche le badge de priorité à la dernière information qui le précède (groupe insécable), compteur à part", () => {
    renderList([
      buildTask({
        title: "Groupée",
        priority: 2,
        tags: ["client"],
        subtaskTotal: 3,
        subtaskDone: 1,
      }),
    ]);

    const link = screen.getByRole("link", { name: /Groupée/ });
    const group = link.querySelector("[data-legend-group]") as HTMLElement;

    expect(group.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "flex-nowrap", "min-w-0"]),
    );
    expect(group.children).toHaveLength(2);
    expect(within(group).getByText("client")).toBeTruthy();
    const badge = within(group).getByText("Priorité haute").parentElement!;
    expect(badge.parentElement).toBe(group);
    expectClasses(badge, PRIORITY_TINT_CLASSES[2]);
    expect(group.querySelector("svg.lucide-list-checks")).toBeNull();
    expect(link.querySelector("svg.lucide-list-checks")).not.toBeNull();
  });

  it("sans information avant lui, le badge de priorité reste seul, sans groupe", () => {
    renderList([buildTask({ title: "Seule", priority: 2 })], {
      showContext: false,
    });

    const link = screen.getByRole("link", { name: /Seule/ });

    expect(link.querySelector("[data-legend-group]")).toBeNull();
    expect(within(link).getByText("Priorité haute")).toBeTruthy();
  });

  it("variante tile : légende sur une ligne inchangée, aucun groupe, badge teinté du niveau", () => {
    render(
      <NextIntlClientProvider
        locale="fr"
        messages={messages}
        timeZone={getUserTimeZone()}
      >
        <TaskRow
          task={buildTask({ title: "Tuile", priority: 2, tags: ["client"] })}
          overdue={false}
          showDate
          showContext={false}
          layout="tile"
        />
      </NextIntlClientProvider>,
    );

    const link = screen.getByRole("link", { name: /Tuile/ });

    expect(link.querySelector("[data-legend-group]")).toBeNull();
    const badge = within(link).getByText("Priorité haute").parentElement!;
    expectClasses(badge, PRIORITY_BADGE_CLASSES);
    expectClasses(badge, PRIORITY_TINT_CLASSES[2]);
    expect(badge.querySelector("svg.lucide-signal-high")).not.toBeNull();
    const legend = badge.parentElement!;
    // Coupée au bord en largeur seulement : la hauteur du badge n'est pas rognée par la cale.
    expectClasses(legend, "flex-nowrap overflow-x-clip whitespace-nowrap");
    expect(legend.className.split(/\s+/)).not.toContain("overflow-hidden");
  });

  it("variante tile : ni badge ni icône pour 0", () => {
    render(
      <NextIntlClientProvider
        locale="fr"
        messages={messages}
        timeZone={getUserTimeZone()}
      >
        <TaskRow
          task={buildTask({ title: "Tuile", priority: 0, tags: ["client"] })}
          overdue={false}
          showDate
          showContext={false}
          layout="tile"
        />
      </NextIntlClientProvider>,
    );

    const link = screen.getByRole("link", { name: /Tuile/ });

    expect(link.querySelector("[class*='bg-priority-']")).toBeNull();
    expect(link.querySelector("svg[class*='lucide-signal']")).toBeNull();
  });

  it("ni badge ni icône de priorité pour 0", () => {
    renderList([buildTask({ title: "Sans priorité", priority: 0 })]);

    const link = screen.getByRole("link", { name: /Sans priorité/ });

    expect(link.querySelector("[class*='bg-priority-']")).toBeNull();
    expect(link.querySelector("svg[class*='lucide-signal']")).toBeNull();
    expect(
      link.querySelector("svg.lucide-square-exclamation-point"),
    ).toBeNull();
  });
});

describe("liste des tâches : pastille d'espace", () => {
  it("absente quand il n'y a rien à distinguer (côté à un seul espace, ou espace filtré)", () => {
    renderList(
      [buildTask({ title: "Payer la crèche", contextName: "Privé" })],
      {
        showContext: false,
      },
    );

    const link = screen.getByRole("link", { name: /Payer la crèche/ });
    expect(within(link).queryByText("Privé")).toBeNull();
  });

  it("prend la couleur de l'espace (chip-warm pour Trustup)", () => {
    renderList([
      buildTask({
        title: "Relancer le devis",
        contextName: "Trustup",
        contextColor: "warm",
      }),
    ]);

    const link = screen.getByRole("link", { name: /Relancer le devis/ });
    const chip = within(link).getByText("Trustup").className.split(/\s+/);
    expect(chip).toEqual(
      expect.arrayContaining(["bg-chip-warm", "text-chip-warm-foreground"]),
    );
    expect(chip).not.toContain("bg-chip-neutral");
  });
});

describe("liste des tâches : cocher", () => {
  it("case désactivée pendant l'appel, sans mise à jour optimiste, puis erreur dans la ligne", async () => {
    const call = deferred<unknown>();
    runAppAction.mockReturnValue(call.promise);
    const task = buildTask({ title: "Payer la crèche" });
    renderList([task]);

    const box = screen.getByRole("checkbox", {
      name: "Terminer « Payer la crèche »",
    }) as HTMLInputElement;
    fireEvent.click(box);

    await waitFor(() => expect(box.disabled).toBe(true));
    expect(box.checked).toBe(false);
    expect(runAppAction).toHaveBeenCalledWith("tasks.complete", {
      taskId: task.id,
    });

    await act(async () => call.resolve({ ok: false, code: "not_found" }));

    const row = screen.getByRole("listitem");
    expect(
      within(row).getByText("Tâche introuvable ou à la corbeille."),
    ).toBeTruthy();
    expect(box.disabled).toBe(false);
    expect(box.checked).toBe(false);
  });

  it("panne sans code : message générique dans la ligne", async () => {
    runAppAction.mockRejectedValue(new Error("panne"));
    renderList([buildTask({ title: "Payer la crèche" })]);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(
      await screen.findByText("Tâche non mise à jour. Réessaie."),
    ).toBeTruthy();
  });

  it("une tâche terminée se rouvre (catégorie À faire)", async () => {
    runAppAction.mockResolvedValue({ ok: true, result: {} });
    const task = buildTask({
      title: "Acheter des ampoules",
      statusCategory: "completed",
      completedAt: new Date("2026-11-18T10:00:00Z"),
    });
    renderList([task]);

    const box = screen.getByRole("checkbox", {
      name: "Rouvrir « Acheter des ampoules »",
    }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(sectionTitles()).toEqual(["Terminées"]);
    fireEvent.click(box);

    await waitFor(() =>
      expect(runAppAction).toHaveBeenCalledWith("tasks.update", {
        taskId: task.id,
        statusCategory: "unstarted",
      }),
    );
  });
});

describe("liste des tâches : tâche annulée", () => {
  function renderCanceled() {
    const task = buildTask({
      title: "Réserver le resto",
      statusCategory: "canceled",
      completedAt: new Date("2026-11-18T10:00:00Z"),
    });
    renderList([task]);
    return task;
  }

  it("se lit comme fermée : case cochée, libellé adapté, repère Annulée visible", () => {
    renderCanceled();

    const box = screen.getByRole("checkbox", {
      name: "Rouvrir « Réserver le resto », annulée",
    }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    const link = screen.getByRole("link", { name: /Réserver le resto/ });
    expect(within(link).getByText("Annulée")).toBeTruthy();
  });

  it("un tap la rouvre vers À faire, jamais tasks.complete", async () => {
    runAppAction.mockResolvedValue({ ok: true, result: {} });
    const task = renderCanceled();

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(runAppAction).toHaveBeenCalledWith("tasks.update", {
        taskId: task.id,
        statusCategory: "unstarted",
      }),
    );
    expect(runAppAction).not.toHaveBeenCalledWith(
      "tasks.complete",
      expect.anything(),
    );
  });
});

describe("liste des tâches : états vides", () => {
  it("vide : une phrase et un bouton qui ouvre l'ajout rapide", () => {
    const { openQuickAdd } = renderList([]);

    fireEvent.click(screen.getByRole("button", { name: "Ajouter une tâche" }));

    expect(openQuickAdd).toHaveBeenCalledOnce();
    expect(screen.queryByText("Rien dans cet espace")).toBeNull();
  });

  it("vide aussi quand seules des sous-tâches sans échéance existent", () => {
    renderList([buildTask({ parentId: PARENT_ID, parentTitle: "Parente" })]);

    expect(
      screen.getByRole("button", { name: "Ajouter une tâche" }),
    ).toBeTruthy();
  });

  it("vide filtré : Rien dans cet espace, et Voir tous les espaces retire le filtre du côté", async () => {
    setContextSelection.mockResolvedValue(undefined);
    renderList([], { filtered: true });

    expect(screen.getByText("Rien dans cet espace")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Voir tous les espaces" }),
    );

    await waitFor(() =>
      expect(setContextSelection).toHaveBeenCalledWith("pro", null),
    );
  });
});

describe("liste des tâches : lien vers le détail", () => {
  it("terminées affichées : le lien de la ligne garde ?completed=1", () => {
    const task = buildTask({ title: "Relancer le devis" });
    renderList([task], { listQuery: "?completed=1" });

    expect(
      screen
        .getByRole("link", { name: /Relancer le devis/ })
        .getAttribute("href"),
    ).toBe(`/tasks/${task.id}?completed=1`);
  });
});
