// @vitest-environment node
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { UserTx } from "@/db/client";

import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import { defineAction } from "./define";
import { ACTION_ERROR_MESSAGES, ActionError } from "./errors";
import {
  createRegistry,
  invokeAction,
  prepareAction,
  registry,
  toToolDefinitions,
} from "./registry";
import type { ActionChannel, ActionContext } from "./types";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const tx = {} as UserTx;
const CTX: ActionContext = {
  workspaceId: WORKSPACE,
  userId: USER,
  origin: "palette",
  tx,
};

// Référence : traduction anglaise de la clé par next-intl, texte à langue fixe (createTranslator).
const t = createTranslator({ locale: "en", messages: en });
const translateInEnglish = (key: string) => t(key as Parameters<typeof t>[0]);

/**
 * Un jeu de paramètres valides par action du registre, pour vérifier la rigueur des JSON Schema.
 * Une action ajoutée au registre sans entrée ici fait échouer le test (tâche 8 : actions tasks.*).
 */
const TASK = "3a1f5c2e-8b7d-4e6f-9a0b-1c2d3e4f5a6b";
const VALID_PARAMS: Record<string, Record<string, unknown>> = {
  "core.listContexts": { side: "pro" },
  "core.setLocale": { locale: "en" },
  "tasks.list": {
    side: "pro",
    context: "Trustup",
    statusCategories: ["unstarted", "started"],
    tag: "client",
    dueOnOrBefore: "2026-11-20",
    query: "devis",
    limit: 20,
  },
  "tasks.get": { taskId: TASK },
  "tasks.listDueToday": {},
  "tasks.listTrash": {},
  "tasks.listTags": {},
  "tasks.create": {
    title: "Relancer le devis",
    side: "pro",
    context: "Trustup",
    statusCategory: "unstarted",
    priority: 2,
    dueDate: "2026-11-20",
    dueTime: "14:00",
    tags: ["client"],
  },
  "tasks.update": {
    taskId: TASK,
    title: "Relancer le devis",
    notes: null,
    priority: 1,
    dueDate: "2026-11-21",
    addTags: ["urgent"],
    removeTags: ["client"],
  },
  "tasks.complete": { taskId: TASK },
  "tasks.moveToTrash": { taskId: TASK },
  "tasks.restore": { taskId: TASK },
};

/**
 * Liste blanche des écritures qu'un modèle peut appeler (canal assistant, ADR-009). Une action write qui
 * déclare ce canal sans être ajoutée ici fait échouer le test : l'exposition d'une écriture à l'assistant
 * est une décision explicite, relue en review.
 */
const ASSISTANT_WRITE_ACTIONS = [
  "core.setLocale",
  "tasks.complete",
  "tasks.create",
  "tasks.moveToTrash",
  "tasks.restore",
  "tasks.update",
];

function fakeAction(
  name: string,
  access: "read" | "write" = "write",
  run = vi.fn(async () => "fait"),
  channels: readonly ActionChannel[] = ["web"],
) {
  return {
    run,
    action: defineAction({
      name,
      description: `actions.test.${name}`,
      params: z.strictObject({ value: z.enum(["a", "b"]) }),
      access,
      channels,
      run,
    }),
  };
}

/** Lit une clé pointée (« actions.core.setLocale ») dans un fichier de messages. */
function messageAt(messages: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages,
    );
}

describe("registre d'actions : déclaration", () => {
  it("chaque action déclare name, description, params et access", () => {
    const declared = [...registry.values()];

    expect(declared.length).toBeGreaterThan(0);
    for (const action of declared) {
      expect(action.name).toMatch(/^[a-z]+\.[a-z][a-zA-Z]*$/);
      expect(action.description).toMatch(/^actions\./);
      expect(action.params).toBeInstanceOf(z.ZodType);
      expect(["read", "write"]).toContain(action.access);
    }
  });

  it("chaque action déclare au moins un canal, sans doublon ni canal inconnu", () => {
    for (const action of registry.values()) {
      expect(action.channels.length, action.name).toBeGreaterThan(0);
      expect(new Set(action.channels).size, action.name).toBe(
        action.channels.length,
      );
      for (const channel of action.channels) {
        expect(["web", "assistant"], action.name).toContain(channel);
      }
    }
  });

  it("les actions du socle sont appelables depuis le web et l'assistant", () => {
    for (const name of ["core.listContexts", "core.setLocale"]) {
      expect(registry.get(name)?.channels).toEqual(["web", "assistant"]);
    }
  });

  it("la description de chaque action est traduite en français et en anglais", () => {
    const descriptions = [...registry.values()].map((a) => a.description);

    for (const key of descriptions) {
      expect(typeof messageAt(fr, key), `${key} (fr)`).toBe("string");
      expect(typeof messageAt(en, key), `${key} (en)`).toBe("string");
    }
  });

  it("déclare les actions du socle : core.listContexts en lecture, core.setLocale en écriture", () => {
    const access = Object.fromEntries(
      [...registry.values()].map((a) => [a.name, a.access]),
    );

    expect(access).toMatchObject({
      "core.listContexts": "read",
      "core.setLocale": "write",
    });
  });

  it("les écritures exposées au canal assistant sont exactement celles de la liste blanche", () => {
    const writes = [...registry.values()]
      .filter((a) => a.access === "write" && a.channels.includes("assistant"))
      .map((a) => a.name)
      .sort();

    expect(writes).toEqual(ASSISTANT_WRITE_ACTIONS);
  });

  it("deux actions ne partagent pas un name", () => {
    const first = fakeAction("test.same").action;
    const second = fakeAction("test.same").action;

    expect(() => createRegistry([first, second])).toThrow(ActionError);
  });

  it("indexe chaque action du registre sous son propre name", () => {
    for (const [name, action] of registry) {
      expect(action.name).toBe(name);
    }
  });
});

describe("registre d'actions : exécution", () => {
  it("valide les paramètres puis appelle run avec le contexte de la session", async () => {
    const { action, run } = fakeAction("test.run");
    const reg = createRegistry([action]);

    const prepared = prepareAction(reg, "test.run", { value: "a" }, "web");
    const result = await invokeAction(prepared, CTX);

    expect(result).toBe("fait");
    expect(run).toHaveBeenCalledWith(CTX, { value: "a" });
  });

  it("des paramètres invalides n'appellent pas run", () => {
    const { action, run } = fakeAction("test.invalid");
    const reg = createRegistry([action]);

    const attempts = [
      { value: "z" },
      {},
      null,
      "a",
      { value: "a", userId: USER },
    ].map((params) => () => prepareAction(reg, "test.invalid", params, "web"));

    for (const attempt of attempts) {
      expect(attempt).toThrow(
        expect.objectContaining({ code: "invalid_params" }),
      );
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("un nom inconnu n'exécute rien", () => {
    const { action, run } = fakeAction("test.known");
    const reg = createRegistry([action]);

    const attempts = ["test.unknown", "__proto__", "constructor", 42, null].map(
      (name) => () => prepareAction(reg, name, { value: "a" }, "web"),
    );

    for (const attempt of attempts) {
      expect(attempt).toThrow(
        expect.objectContaining({ code: "unknown_action" }),
      );
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("une action appelée depuis un canal qu'elle ne déclare pas est inconnue et n'exécute rien", () => {
    const { action, run } = fakeAction(
      "test.assistantOnly",
      "write",
      undefined,
      ["assistant"],
    );
    const bind = vi.spyOn(action, "bind");
    const reg = createRegistry([action]);

    expect(() =>
      prepareAction(reg, "test.assistantOnly", { value: "a" }, "web"),
    ).toThrow(expect.objectContaining({ code: "unknown_action" }));
    expect(bind).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("une action write sans workspaceId refuse de s'exécuter", async () => {
    const { action, run } = fakeAction("test.write", "write");
    const prepared = prepareAction(
      createRegistry([action]),
      "test.write",
      { value: "a" },
      "web",
    );

    const missing = [
      { ...CTX, workspaceId: "" },
      { ...CTX, workspaceId: undefined as unknown as string },
      { ...CTX, workspaceId: "pas-un-uuid" },
    ];

    for (const ctx of missing) {
      await expect(invokeAction(prepared, ctx)).rejects.toMatchObject({
        code: "missing_context",
      });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("une action sans userId ou sans transaction refuse de s'exécuter, en lecture comme en écriture", async () => {
    const write = fakeAction("test.write", "write");
    const read = fakeAction("test.read", "read");
    const reg = createRegistry([write.action, read.action]);

    for (const name of ["test.write", "test.read"]) {
      const prepared = prepareAction(reg, name, { value: "a" }, "web");
      await expect(
        invokeAction(prepared, { ...CTX, userId: "" }),
      ).rejects.toMatchObject({ code: "missing_context" });
      await expect(
        invokeAction(prepared, { ...CTX, tx: undefined as unknown as UserTx }),
      ).rejects.toMatchObject({ code: "missing_context" });
    }
    expect(write.run).not.toHaveBeenCalled();
    expect(read.run).not.toHaveBeenCalled();
  });
});

describe("registre d'actions : origine de l'appel", () => {
  it("un contexte sans origine, ou d'origine inconnue, refuse de s'exécuter (missing_context)", async () => {
    const write = fakeAction("test.write", "write");
    const read = fakeAction("test.read", "read");
    const reg = createRegistry([write.action, read.action]);

    for (const name of ["test.write", "test.read"]) {
      const prepared = prepareAction(reg, name, { value: "a" }, "web");
      for (const origin of [undefined, "", "evil", "whatsapp"]) {
        await expect(
          invokeAction(prepared, {
            ...CTX,
            origin: origin as unknown as ActionContext["origin"],
          }),
        ).rejects.toMatchObject({ code: "missing_context" });
      }
    }
    expect(write.run).not.toHaveBeenCalled();
    expect(read.run).not.toHaveBeenCalled();
  });

  it("chaque origine déclarée est transmise telle quelle à run", async () => {
    const { action, run } = fakeAction("test.origin");
    const prepared = prepareAction(
      createRegistry([action]),
      "test.origin",
      { value: "a" },
      "web",
    );

    for (const origin of ["app", "palette", "assistant"] as const) {
      await invokeAction(prepared, { ...CTX, origin });
      expect(run).toHaveBeenLastCalledWith({ ...CTX, origin }, { value: "a" });
    }
  });
});

/** Toutes les clés de propriétés d'un JSON Schema, à toute profondeur. */
function propertyKeys(schema: unknown): string[] {
  if (!schema || typeof schema !== "object") return [];
  const node = schema as Record<string, unknown>;
  const own =
    node.properties && typeof node.properties === "object"
      ? Object.keys(node.properties)
      : [];
  return [...own, ...Object.values(node).flatMap(propertyKeys)];
}

describe("registre d'actions : définitions d'outils pour un modèle", () => {
  it("par défaut, la description est la traduction anglaise réelle : ni la clé, ni le français", () => {
    const tools = toToolDefinitions("assistant");

    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      const key = registry.get(tool.name)!.description;
      expect(tool.description, tool.name).toBe(translateInEnglish(key));
      expect(tool.description, tool.name).not.toBe(key);
      expect(tool.description, tool.name).not.toBe(messageAt(fr, key));
    }
  });

  it("toToolDefinitions('assistant') : nom, description anglaise en clair, JSON Schema des paramètres", () => {
    const tools = toToolDefinitions("assistant");

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      [...registry.values()]
        .filter((a) => a.channels.includes("assistant"))
        .map((a) => a.name)
        .sort(),
    );
    expect(tools).toContainEqual({
      name: "core.setLocale",
      description: en.actions.core.setLocale,
      inputSchema: expect.objectContaining({
        type: "object",
        properties: {
          locale: expect.objectContaining({
            type: "string",
            enum: ["fr", "en"],
            description: expect.any(String),
          }),
        },
        required: ["locale"],
        additionalProperties: false,
      }),
    });
    for (const tool of tools) {
      expect(tool.description, tool.name).not.toMatch(/^actions\./);
      expect(tool.description, tool.name).toBe(
        messageAt(en, registry.get(tool.name)!.description),
      );
    }
  });

  it("chaque action du registre a un jeu de paramètres valides, accepté par son schéma", () => {
    for (const action of registry.values()) {
      const valid = VALID_PARAMS[action.name];
      expect(
        valid,
        `${action.name} : entrée manquante dans VALID_PARAMS`,
      ).toBeDefined();
      expect(action.params.safeParse(valid).success, action.name).toBe(true);
    }
  });

  it("chaque JSON Schema est valide et strict : relu par zod, il accepte les paramètres valides et refuse une clé en trop", () => {
    for (const channel of ["web", "assistant"] as const) {
      for (const tool of toToolDefinitions(channel)) {
        const valid = VALID_PARAMS[tool.name];
        expect(
          valid,
          `${tool.name} : entrée manquante dans VALID_PARAMS`,
        ).toBeDefined();
        const reread = z.fromJSONSchema(tool.inputSchema);

        expect(reread.safeParse(valid).success, tool.name).toBe(true);
        for (const extra of ["unexpected", "workspaceId", "userId", "origin"]) {
          expect(
            reread.safeParse({ ...valid, [extra]: "x" }).success,
            `${tool.name} + ${extra}`,
          ).toBe(false);
        }
      }
    }
    const setLocale = toToolDefinitions("assistant").find(
      (tool) => tool.name === "core.setLocale",
    );
    const reread = z.fromJSONSchema(setLocale!.inputSchema);
    expect(reread.safeParse({ locale: "de" }).success).toBe(false);
  });

  it("chaque champ des paramètres porte une description pour le modèle", () => {
    for (const tool of toToolDefinitions("assistant")) {
      const properties = (tool.inputSchema.properties ?? {}) as Record<
        string,
        { description?: unknown }
      >;
      for (const [key, property] of Object.entries(properties)) {
        expect(typeof property.description, `${tool.name}.${key}`).toBe(
          "string",
        );
      }
    }
  });

  it("aucun schéma n'expose workspaceId, userId ni origin, à aucune profondeur", () => {
    for (const channel of ["web", "assistant"] as const) {
      for (const tool of toToolDefinitions(channel)) {
        const keys = propertyKeys(tool.inputSchema);
        for (const reserved of ["workspaceId", "userId", "origin"]) {
          expect(keys, `${tool.name} : ${reserved}`).not.toContain(reserved);
        }
      }
    }
  });

  it("chaque description anglaise dit, pour un modèle, quand utiliser l'action et ce qu'elle renvoie", () => {
    for (const tool of toToolDefinitions("assistant")) {
      expect(tool.description, tool.name).toMatch(/\bUse it\b/);
      expect(tool.description, tool.name).toMatch(/\bReturns\b/);
    }
  });

  it("une action qui ne déclare pas le canal n'apparaît pas dans ses définitions", () => {
    const web = fakeAction("test.webOnly", "read", undefined, ["web"]);
    const both = fakeAction("test.both", "read", undefined, [
      "web",
      "assistant",
    ]);
    const actions = createRegistry([web.action, both.action]);

    const names = toToolDefinitions("assistant", {
      actions,
      describe: (key) => key,
    }).map((tool) => tool.name);

    expect(names).toEqual(["test.both"]);
  });
});

describe("registre d'actions : messages d'erreur pour un modèle", () => {
  it("chaque code du registre a un message anglais fixe, sans gabarit", () => {
    for (const code of [
      "unknown_action",
      "invalid_params",
      "missing_context",
      "duplicate_action",
    ] as const) {
      const message = ACTION_ERROR_MESSAGES[code];

      expect(message.trim().length, code).toBeGreaterThan(0);
      expect(message, code).not.toMatch(/[{}]/);
    }
  });

  it("le message d'un refus ne recopie ni le nom ni les paramètres reçus", () => {
    const { action } = fakeAction("test.known");
    const reg = createRegistry([action]);
    const attempts: [unknown, unknown][] = [
      ["test.secret-name-4242", { value: "a" }],
      ["test.known", { value: "valeur-secrete-4242" }],
    ];

    for (const [name, params] of attempts) {
      let caught: unknown;
      try {
        prepareAction(reg, name, params, "web");
      } catch (error) {
        caught = error;
      }

      const { code, message } = caught as ActionError;
      expect(message).toBe(code);
      expect(ACTION_ERROR_MESSAGES[code]).not.toContain("4242");
    }
  });
});
