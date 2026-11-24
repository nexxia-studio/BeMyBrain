import { describe, expect, it } from "vitest";

import { isKanbanDemoEnabled } from "./demo-access";

describe("accès à la démo du kanban", () => {
  it("est ouverte en développement local", () => {
    expect(
      isKanbanDemoEnabled({ NODE_ENV: "development", VERCEL_ENV: undefined }),
    ).toBe(true);
  });

  it("est ouverte sur une preview Vercel", () => {
    expect(
      isKanbanDemoEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).toBe(true);
  });

  it("est fermée en production Vercel", () => {
    expect(
      isKanbanDemoEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    ).toBe(false);
  });

  it("est fermée sur un build de production hors Vercel (next start, e2e)", () => {
    expect(
      isKanbanDemoEnabled({ NODE_ENV: "production", VERCEL_ENV: undefined }),
    ).toBe(false);
  });

  it("reste fermée en production Vercel même si NODE_ENV vaut development", () => {
    expect(
      isKanbanDemoEnabled({ NODE_ENV: "development", VERCEL_ENV: "production" }),
    ).toBe(false);
  });

  it("est fermée pour toute valeur inconnue de VERCEL_ENV", () => {
    expect(
      isKanbanDemoEnabled({ NODE_ENV: "production", VERCEL_ENV: "staging" }),
    ).toBe(false);
  });
});
