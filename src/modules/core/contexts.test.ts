// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({}));
const listContexts = vi.hoisted(() => vi.fn());
const withUserDb = vi.hoisted(() =>
  vi.fn(async (_token: string, fn: (t: unknown) => unknown) => fn(tx)),
);

vi.mock("@/db/client", () => ({ withUserDb }));
vi.mock("./queries", () => ({ listContexts }));

import { loadContexts } from "./contexts";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";

describe("loadContexts", () => {
  it("lit les contextes d'un côté du workspace dans une transaction ouverte avec le jeton", async () => {
    const nexxia = {
      id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
      name: "Nexxia",
      side: "pro",
      position: 2,
    };
    listContexts.mockResolvedValue([nexxia]);

    const contexts = await loadContexts("eyJ.jwt.signe", WORKSPACE, "pro");

    expect(withUserDb).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      expect.any(Function),
    );
    expect(listContexts).toHaveBeenCalledWith(WORKSPACE, { side: "pro" }, tx);
    expect(contexts).toEqual([nexxia]);
  });
});
