// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({}));
const listContexts = vi.hoisted(() => vi.fn());
const withUserDb = vi.hoisted(() =>
  vi.fn(async (_token: string, fn: (t: unknown) => unknown) => fn(tx)),
);

vi.mock("@/db/client", () => ({ withUserDb }));
vi.mock("./queries", () => ({ listContexts }));

import { loadContexts, loadContextsBySide } from "./contexts";

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

describe("loadContextsBySide", () => {
  it("lit les contextes des deux côtés dans une seule transaction ouverte avec le jeton", async () => {
    withUserDb.mockClear();
    listContexts.mockReset();
    const prive = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Privé" };
    const nexxia = {
      id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
      name: "Nexxia",
    };
    listContexts.mockImplementation(
      async (_workspace: string, { side }: { side: string }) =>
        side === "private" ? [prive] : [nexxia],
    );

    const bySide = await loadContextsBySide("eyJ.jwt.signe", WORKSPACE);

    expect(withUserDb).toHaveBeenCalledTimes(1);
    expect(listContexts).toHaveBeenCalledWith(
      WORKSPACE,
      { side: "private" },
      tx,
    );
    expect(listContexts).toHaveBeenCalledWith(WORKSPACE, { side: "pro" }, tx);
    expect(bySide).toEqual({ private: [prive], pro: [nexxia] });
  });
});
