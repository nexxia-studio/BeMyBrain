// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/components/shell/nav-items";
import { prepareAction, registry } from "@/modules/actions/registry";

import { isPaletteShortcut, matchesCommand, paletteCommands } from "./commands";

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

describe("commandes de la palette", () => {
  it("propose chaque section de la navigation en raccourci, hors registre", () => {
    const { navigation } = paletteCommands("fr");

    expect(navigation.map((c) => c.href)).toEqual(NAV_ITEMS.map((i) => i.href));
  });

  it("propose de passer dans l'autre langue, jamais dans la langue courante", () => {
    expect(paletteCommands("fr").actions.map((c) => c.params)).toEqual([
      { locale: "en" },
    ]);
    expect(paletteCommands("en").actions.map((c) => c.params)).toEqual([
      { locale: "fr" },
    ]);
  });

  it("chaque commande d'action désigne une action du registre, avec des paramètres valides", () => {
    const commands = [
      ...paletteCommands("fr").actions,
      ...paletteCommands("en").actions,
    ];

    for (const command of commands) {
      expect(() =>
        prepareAction(registry, command.action, command.params),
      ).not.toThrow();
    }
  });

  it("donne à chaque commande un identifiant unique", () => {
    const { navigation, actions } = paletteCommands("fr");
    const ids = [...navigation, ...actions].map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
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
