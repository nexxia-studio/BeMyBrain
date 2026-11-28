import { describe, expect, it, vi } from "vitest";

import type { UserTx } from "@/db/client";

import { AISLE_KEYS } from "./aisles";
import { moveItemToAisle, setAisleOrder } from "./mutations";

// Paramètres refusés avant toute requête : la transaction factice échoue si elle est touchée.
const untouchedTx = new Proxy(
  {},
  {
    get() {
      throw new Error("transaction touchée");
    },
  },
) as unknown as UserTx;

const WORKSPACE = "00000000-0000-4000-8000-000000000001";
const ITEM = "00000000-0000-4000-8000-000000000002";

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? "autre",
  );

describe("setAisleOrder : un ordre qui n'est pas une permutation des rayons est refusé", () => {
  const [first, ...rest] = [...AISLE_KEYS];

  it.each([
    ["tableau vide", []],
    [
      "tableau à trou (douze cases, une vide)",
      [first, , ...rest.slice(1)],
    ],
    ["rayon manquant", rest],
    [
      "doublon (douze entrées, une clé répétée)",
      [first, first, ...rest.slice(1)],
    ],
    ["clé inconnue", ["inconnu", ...rest]],
    ["clé en trop", [...AISLE_KEYS, "produce"]],
    ["clé de casse différente", ["PRODUCE", ...rest]],
    ["entrée qui n'est pas du texte", [42, ...rest]],
  ])("refuse %s en invalid_params", async (_n, order) => {
    expect(
      await codeOf(
        setAisleOrder(WORKSPACE, order as unknown as string[], untouchedTx),
      ),
    ).toBe("invalid_params");
  });

  it("refuse une valeur qui n'est pas un tableau", async () => {
    expect(
      await codeOf(
        setAisleOrder(WORKSPACE, "produce" as unknown as string[], untouchedTx),
      ),
    ).toBe("invalid_params");
  });

  it("refuse un workspace qui n'est pas un uuid", async () => {
    expect(await codeOf(setAisleOrder("x", [...AISLE_KEYS], untouchedTx))).toBe(
      "invalid_params",
    );
  });
});

describe("setAisleOrder : lecture unique et non-membre", () => {
  const fakeTx = (member: boolean) => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ member }] });
    return { tx: { execute } as unknown as UserTx, execute };
  };

  it("lit le tableau une seule fois et écrit les clés validées", async () => {
    let reads = 0;
    const order: string[] = [...AISLE_KEYS];
    const native = order[Symbol.iterator].bind(order);
    Object.defineProperty(order, Symbol.iterator, {
      value: () => {
        reads += 1;
        return native();
      },
    });
    const { tx, execute } = fakeTx(true);

    const saved = await setAisleOrder(WORKSPACE, order, tx);

    expect(reads).toBe(1);
    expect(saved).toEqual([...AISLE_KEYS]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("refuse un non-membre en invalid_params sans écrire", async () => {
    const { tx, execute } = fakeTx(false);

    expect(await codeOf(setAisleOrder(WORKSPACE, [...AISLE_KEYS], tx))).toBe(
      "invalid_params",
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("moveItemToAisle : refus avant toute requête", () => {
  it("refuse un rayon inconnu", async () => {
    expect(
      await codeOf(moveItemToAisle(WORKSPACE, ITEM, "inconnu", untouchedTx)),
    ).toBe("invalid_params");
  });

  it("refuse un rayon qui n'est pas du texte", async () => {
    expect(
      await codeOf(
        moveItemToAisle(
          WORKSPACE,
          ITEM,
          undefined as unknown as string,
          untouchedTx,
        ),
      ),
    ).toBe("invalid_params");
  });

  it("refuse un id d'article ou de workspace qui n'est pas un uuid", async () => {
    expect(
      await codeOf(moveItemToAisle(WORKSPACE, "x", "produce", untouchedTx)),
    ).toBe("invalid_params");
    expect(
      await codeOf(moveItemToAisle("x", ITEM, "produce", untouchedTx)),
    ).toBe("invalid_params");
  });
});
