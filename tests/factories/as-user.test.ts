// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestUserDb } from "./as-user";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createTestUserDb", () => {
  it("refuse de s'exécuter hors de Vitest", () => {
    vi.stubEnv("VITEST", undefined);

    const create = () => createTestUserDb("postgres://inutilise");

    expect(create).toThrow(/Vitest/);
  });
});
