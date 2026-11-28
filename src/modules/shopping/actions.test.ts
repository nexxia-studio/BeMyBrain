// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserTx } from "@/db/client";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const m = vi.hoisted(() => ({
  getShoppingList: vi.fn(),
  addItem: vi.fn(),
  checkItem: vi.fn(),
  uncheckItem: vi.fn(),
  renameItem: vi.fn(),
  removeItem: vi.fn(),
  clearChecked: vi.fn(),
  moveItemToAisle: vi.fn(),
  setAisleOrder: vi.fn(),
}));

vi.mock("./queries", () => ({ getShoppingList: m.getShoppingList }));
vi.mock("./mutations", () => ({
  addItem: m.addItem,
  checkItem: m.checkItem,
  uncheckItem: m.uncheckItem,
  renameItem: m.renameItem,
  removeItem: m.removeItem,
  clearChecked: m.clearChecked,
  moveItemToAisle: m.moveItemToAisle,
  setAisleOrder: m.setAisleOrder,
}));

import {
  invokeAction,
  prepareAction,
  registry,
  toToolDefinitions,
} from "../actions/registry";
import { shoppingActions } from "./actions";
import { AISLE_KEYS } from "./aisles";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const OTHER_WORKSPACE = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const ITEM = "3a1f5c2e-8b7d-4e6f-9a0b-1c2d3e4f5a6b";
const tx = {} as UserTx;
const CTX = {
  workspaceId: WORKSPACE,
  userId: USER,
  origin: "app" as const,
  tx,
};

const VALID: Record<string, Record<string, unknown>> = {
  "shopping.listItems": {},
  "shopping.addItem": { label: "Lait" },
  "shopping.checkItem": { itemId: ITEM },
  "shopping.uncheckItem": { itemId: ITEM },
  "shopping.renameItem": { itemId: ITEM, label: "Lait entier" },
  "shopping.removeItem": { itemId: ITEM },
  "shopping.clearChecked": {},
  "shopping.moveItemToAisle": { itemId: ITEM, aisleKey: "dairyEggs" },
  "shopping.setAisleOrder": { order: [...AISLE_KEYS].reverse() },
};
const NAMES = Object.keys(VALID);
const ASSISTANT = [
  "shopping.listItems",
  "shopping.addItem",
  "shopping.checkItem",
];

const prepare = (name: string, params: unknown) => () =>
  prepareAction(registry, name, params, "web");
const nothingCalled = () =>
  Object.values(m).flatMap((fn) => fn.mock.calls).length === 0;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("actions shopping.* : déclaration", () => {
  it("déclare les neuf actions, rangées au registre", () => {
    expect(shoppingActions.map((a) => a.name)).toEqual(NAMES);
    for (const action of shoppingActions) {
      expect(registry.get(action.name), action.name).toBe(action);
    }
  });

  it("listItems en lecture, toutes les autres en écriture", () => {
    for (const action of shoppingActions) {
      expect(action.access, action.name).toBe(
        action.name === "shopping.listItems" ? "read" : "write",
      );
    }
  });

  it("le canal assistant ne contient que listItems, addItem et checkItem", () => {
    const names = shoppingActions
      .filter((a) => a.channels.includes("assistant"))
      .map((a) => a.name);

    expect(names).toEqual(ASSISTANT);
    expect(
      toToolDefinitions("assistant")
        .map((t) => t.name)
        .filter((n) => n.startsWith("shopping."))
        .sort(),
    ).toEqual([...ASSISTANT].sort());
    for (const action of shoppingActions) {
      expect(action.channels, action.name).toContain("web");
    }
  });

  it("une action hors liste blanche est inconnue pour l'assistant et n'exécute rien", () => {
    for (const name of NAMES.filter((n) => !ASSISTANT.includes(n))) {
      expect(() =>
        prepareAction(registry, name, VALID[name], "assistant"),
      ).toThrow(expect.objectContaining({ code: "unknown_action" }));
    }
    expect(nothingCalled()).toBe(true);
  });

  it("chaque action a une description française et anglaise non vides, distinctes", () => {
    const english = en.actions.shopping as Record<string, string>;
    const french = fr.actions.shopping as Record<string, string>;

    for (const action of shoppingActions) {
      const key = action.name.slice("shopping.".length);
      expect(action.description).toBe(`actions.shopping.${key}`);
      expect(english[key]?.trim(), `${key} (en)`).toBeTruthy();
      expect(french[key]?.trim(), `${key} (fr)`).toBeTruthy();
      expect(french[key]).not.toBe(english[key]);
    }
    expect(Object.keys(english).sort()).toEqual(
      NAMES.map((n) => n.slice(9)).sort(),
    );
  });
});

describe("actions shopping.* : paramètres hors schéma", () => {
  it("accepte les paramètres valides, refuse toute clé en trop (workspaceId, userId, origin, listId)", () => {
    for (const name of NAMES) {
      expect(prepare(name, VALID[name]), name).not.toThrow();
      for (const [extra, value] of [
        ["workspaceId", OTHER_WORKSPACE],
        ["workspace_id", OTHER_WORKSPACE],
        ["userId", USER],
        ["origin", "assistant"],
        ["listId", ITEM],
      ]) {
        expect(
          prepare(name, { ...VALID[name], [extra]: value }),
          `${name} + ${extra}`,
        ).toThrow(
          expect.objectContaining({
            code: "invalid_params",
            message: "invalid_params",
          }),
        );
      }
    }
    expect(nothingCalled()).toBe(true);
  });

  it("refuse des valeurs hors schéma sans rien appeler", () => {
    const attempts: [string, unknown][] = [
      ["shopping.listItems", null],
      ["shopping.listItems", { x: 1 }],
      ["shopping.addItem", {}],
      ["shopping.addItem", { label: "" }],
      ["shopping.addItem", { label: 42 }],
      ["shopping.addItem", { label: "x".repeat(401) }],
      ["shopping.checkItem", { itemId: "pas-un-uuid" }],
      ["shopping.uncheckItem", {}],
      ["shopping.renameItem", { itemId: ITEM }],
      ["shopping.removeItem", { itemId: 1 }],
      ["shopping.clearChecked", { all: true }],
      ["shopping.moveItemToAisle", { itemId: ITEM, aisleKey: "inconnu" }],
      ["shopping.setAisleOrder", { order: [] }],
      ["shopping.setAisleOrder", { order: [...AISLE_KEYS, "produce"] }],
      ["shopping.setAisleOrder", { order: "produce" }],
    ];

    for (const [name, params] of attempts) {
      expect(
        prepare(name, params),
        `${name} ${JSON.stringify(params)}`,
      ).toThrow(expect.objectContaining({ code: "invalid_params" }));
    }
    expect(nothingCalled()).toBe(true);
  });

  it("chaque champ des schémas d'outil porte une description", () => {
    for (const tool of toToolDefinitions("web").concat(
      toToolDefinitions("assistant"),
    )) {
      if (!tool.name.startsWith("shopping.")) continue;
      const props = (tool.inputSchema.properties ?? {}) as Record<
        string,
        { description?: string }
      >;
      for (const [key, p] of Object.entries(props)) {
        expect((p.description ?? "").trim(), `${tool.name}.${key}`).not.toBe(
          "",
        );
      }
    }
  });
});

describe("actions shopping.* : contexte", () => {
  it("refuse un contexte incomplet sans appeler le module", async () => {
    const broken = [
      { ...CTX, workspaceId: "" },
      { ...CTX, workspaceId: "pas-un-uuid" },
      { ...CTX, userId: "" },
      { ...CTX, tx: undefined as unknown as UserTx },
      { ...CTX, origin: undefined as unknown as "app" },
    ];

    for (const name of NAMES) {
      const prepared = prepareAction(registry, name, VALID[name], "web");
      for (const ctx of broken) {
        await expect(invokeAction(prepared, ctx), name).rejects.toMatchObject({
          code: "missing_context",
        });
      }
    }
    expect(nothingCalled()).toBe(true);
  });

  it("passe le workspaceId du contexte et la transaction, une seule fonction du module par action", async () => {
    m.getShoppingList.mockResolvedValue("liste");
    for (const fn of Object.values(m)) fn.mockResolvedValue("ok");
    const expected: Record<string, [keyof typeof m, unknown[]]> = {
      "shopping.listItems": ["getShoppingList", [WORKSPACE, tx]],
      "shopping.addItem": ["addItem", [WORKSPACE, "Lait", tx]],
      "shopping.checkItem": ["checkItem", [WORKSPACE, ITEM, tx]],
      "shopping.uncheckItem": ["uncheckItem", [WORKSPACE, ITEM, tx]],
      "shopping.renameItem": [
        "renameItem",
        [WORKSPACE, ITEM, "Lait entier", tx],
      ],
      "shopping.removeItem": ["removeItem", [WORKSPACE, ITEM, tx]],
      "shopping.clearChecked": ["clearChecked", [WORKSPACE, tx]],
      "shopping.moveItemToAisle": [
        "moveItemToAisle",
        [WORKSPACE, ITEM, "dairyEggs", tx],
      ],
      "shopping.setAisleOrder": [
        "setAisleOrder",
        [WORKSPACE, [...AISLE_KEYS].reverse(), tx],
      ],
    };

    for (const name of NAMES) {
      vi.clearAllMocks();
      for (const fn of Object.values(m)) fn.mockResolvedValue("ok");

      await invokeAction(
        prepareAction(registry, name, VALID[name], "web"),
        CTX,
      );

      const [fn, args] = expected[name];
      const called = Object.entries(m).filter(([, f]) => f.mock.calls.length);
      expect(
        called.map(([n]) => n),
        name,
      ).toEqual([fn]);
      expect(m[fn]).toHaveBeenCalledTimes(1);
      expect(m[fn].mock.calls[0], name).toEqual(args);
    }
  });
});
