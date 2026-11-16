// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { UserTx } from "@/db/client";

import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import { defineAction } from "./define";
import { ActionError } from "./errors";
import {
  createRegistry,
  invokeAction,
  prepareAction,
  registry,
} from "./registry";
import type { ActionChannel, ActionContext } from "./types";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const tx = {} as UserTx;
const CTX: ActionContext = { workspaceId: WORKSPACE, userId: USER, tx };

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
