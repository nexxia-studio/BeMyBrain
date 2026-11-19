// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/components/shell/nav-items";
import { prepareAction, registry } from "@/modules/actions/registry";

import { TASK_TITLE_MAX } from "@/modules/tasks/sides";

import {
  arrangeAddTask,
  isPaletteShortcut,
  matchesCommand,
  type PaletteGroupKey,
  type PaletteScope,
  paletteGroups,
} from "./commands";

const key = (
  value: string,
  modifiers: Partial<
    Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>
  > = {},
) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("raccourci de la palette", () => {
  it("s'ouvre avec ⌘K sur Mac et Ctrl+K ailleurs, majuscule comprise", () => {
    expect(isPaletteShortcut(key("k", { metaKey: true }))).toBe(true);
    expect(isPaletteShortcut(key("k", { ctrlKey: true }))).toBe(true);
    expect(isPaletteShortcut(key("K", { metaKey: true }))).toBe(true);
  });

  it("ignore K seul et les combinaisons avec Alt ou Maj", () => {
    expect(isPaletteShortcut(key("k"))).toBe(false);
    expect(isPaletteShortcut(key("k", { metaKey: true, altKey: true }))).toBe(
      false,
    );
    expect(isPaletteShortcut(key("k", { ctrlKey: true, shiftKey: true }))).toBe(
      false,
    );
    expect(isPaletteShortcut(key("j", { metaKey: true }))).toBe(false);
  });
});

const SCOPE = {
  side: "pro" as const,
  contexts: [
    { id: "c1", name: "Nexxia", color: "indigo" as const },
    { id: "c2", name: "Viniz", color: "neutral" as const },
  ],
  contextId: null,
};

function commandsFor(query = "", scope: PaletteScope = SCOPE) {
  return paletteGroups("fr", { query, scope });
}

function group(groups: ReturnType<typeof paletteGroups>, value: string) {
  return groups.find((g) => g.value === value)?.commands ?? [];
}

describe("commandes de la palette", () => {
  it("propose chaque section de la navigation en raccourci, hors registre, sauf la To-do", () => {
    const navigation = group(commandsFor(), "navigation");

    expect(navigation.map((c) => c.kind === "navigate" && c.href)).toEqual(
      NAV_ITEMS.map((i) => i.href).filter((href) => href !== "/tasks"),
    );
  });

  it("la To-do n'apparaît qu'une fois dans la palette, par Ouvrir la to-do", () => {
    const toTodo = commandsFor()
      .flatMap((g) => g.commands)
      .filter((c) => c.kind === "navigate" && c.href === "/tasks");

    expect(toTodo.map((c) => c.labelKey)).toEqual(["openTodo"]);
  });

  it("propose de passer dans l'autre langue, jamais dans la langue courante", () => {
    const params = (locale: "fr" | "en") =>
      group(paletteGroups(locale, { query: "", scope: SCOPE }), "actions").map(
        (c) => c.kind === "action" && c.params,
      );

    expect(params("fr")).toEqual([{ locale: "en" }]);
    expect(params("en")).toEqual([{ locale: "fr" }]);
  });

  it("propose les commandes Nouvelle tâche, Ouvrir la to-do et Corbeille, en premier groupe", () => {
    const groups = commandsFor();

    expect(groups[0].value).toBe("tasks");
    expect(
      groups[0].commands.map((c) => [
        c.kind,
        c.labelKey,
        "href" in c && c.href,
      ]),
    ).toEqual([
      ["quickAdd", "newTask", false],
      ["navigate", "openTodo", "/tasks"],
      ["navigate", "openTrash", "/tasks/trash"],
    ]);
  });

  it("saisie libre : le premier élément est Ajouter la tâche « … », avec le texte saisi", () => {
    const [first] = commandsFor("  Payer la crèche ").flatMap(
      (g) => g.commands,
    );

    expect(first).toMatchObject({
      kind: "action",
      action: "tasks.create",
      labelKey: "addTask",
      title: "Payer la crèche",
      params: { title: "Payer la crèche", side: "pro" },
    });
  });

  it("sans saisie, aucune proposition d'ajout", () => {
    const actions = commandsFor("   ")
      .flatMap((g) => g.commands)
      .filter((c) => c.kind === "action" && c.action === "tasks.create");

    expect(actions).toEqual([]);
  });

  it("l'ajout prend le côté et l'espace courants (espace filtré), sinon aucun espace", () => {
    const filtered = commandsFor("Devis", { ...SCOPE, contextId: "c2" })[0]
      .commands[0];
    const unfiltered = commandsFor("Devis")[0].commands[0];

    expect(filtered.kind === "action" && filtered.params).toEqual({
      title: "Devis",
      side: "pro",
      context: "Viniz",
    });
    expect(unfiltered.kind === "action" && unfiltered.params).toEqual({
      title: "Devis",
      side: "pro",
    });
  });

  it("un titre plus long que la limite n'est pas proposé à l'ajout", () => {
    const first = commandsFor("a".repeat(TASK_TITLE_MAX + 1))[0].commands[0];

    expect(first.kind).not.toBe("action");
  });

  it("chaque commande d'action désigne une action du registre, avec des paramètres valides", () => {
    const commands = (["fr", "en"] as const).flatMap((locale) =>
      paletteGroups(locale, {
        query: "Payer la crèche",
        scope: { ...SCOPE, contextId: "c1" },
      }).flatMap((g) => g.commands),
    );
    const actions = commands.filter((c) => c.kind === "action");

    expect(actions.map((c) => c.action)).toContain("tasks.create");
    for (const command of actions) {
      expect(() =>
        prepareAction(registry, command.action, command.params, "web"),
      ).not.toThrow();
    }
  });

  it("donne à chaque commande un identifiant unique", () => {
    const ids = commandsFor("Payer")
      .flatMap((g) => g.commands)
      .map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("place de l'ajout de la tâche", () => {
  type Item = { id: string; label: string; keywords: string; add?: boolean };
  const groups = (query: string) =>
    arrangeAddTask(
      [
        {
          value: "tasks",
          items: [
            {
              id: "add",
              label: `Ajouter la tâche « ${query} »`,
              keywords: "",
              add: true,
            },
            { id: "trash", label: "Corbeille", keywords: "" },
          ],
        },
        {
          value: "actions",
          items: [{ id: "en", label: "Passer en anglais", keywords: "langue" }],
        },
      ] as { value: PaletteGroupKey; items: Item[] }[],
      query,
      (item) => item.add === true,
    ).map((g) => [g.value, g.items.map((i) => i.id)]);

  it("aucune commande ne correspond : l'ajout reste premier", () => {
    expect(groups("Payer la crèche")).toEqual([
      ["tasks", ["add", "trash"]],
      ["actions", ["en"]],
    ]);
  });

  it("une commande correspond : l'ajout passe après la dernière commande correspondante", () => {
    expect(groups("langue")).toEqual([
      ["tasks", ["trash"]],
      ["actions", ["en", "add"]],
    ]);
    expect(groups("corb")).toEqual([
      ["tasks", ["trash", "add"]],
      ["actions", ["en"]],
    ]);
  });
});

describe("recherche dans la palette", () => {
  const command = { label: "Passer en anglais", keywords: "langue language" };

  it("trouve une commande par un mot-clé, sans tenir compte des accents ni de la casse", () => {
    expect(matchesCommand(command, "LANGUE")).toBe(true);
    expect(matchesCommand(command, "anglais")).toBe(true);
    expect(matchesCommand({ label: "Réglages", keywords: "" }, "regl")).toBe(
      true,
    );
  });

  it("exige chaque mot de la recherche", () => {
    expect(matchesCommand(command, "passer langue")).toBe(true);
    expect(matchesCommand(command, "passer réglages")).toBe(false);
  });

  it("une recherche vide garde toutes les commandes", () => {
    expect(matchesCommand(command, "   ")).toBe(true);
  });
});
