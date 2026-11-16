// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({}));
const setMemberLocale = vi.hoisted(() => vi.fn());
const withUserDb = vi.hoisted(() =>
  vi.fn(
    async (
      _token: string,
      fn: (t: unknown, identity: { userId: string }) => unknown,
    ) => fn(tx, { userId: JWT_USER }),
  ),
);
const JWT_USER = vi.hoisted(() => "dc42fa70-09a7-4038-a3bb-f61dda854910");

vi.mock("@/db/client", () => ({ withUserDb }));
vi.mock("./mutations", () => ({ setMemberLocale }));

import { saveMemberLocale } from "./locale";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";

describe("saveMemberLocale", () => {
  it("enregistre la langue du membre du jeton dans le workspace donné, dans une transaction ouverte avec le jeton", async () => {
    setMemberLocale.mockResolvedValue("en");

    const saved = await saveMemberLocale("eyJ.jwt.signe", WORKSPACE, "en");

    expect(withUserDb).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      expect.any(Function),
    );
    expect(setMemberLocale).toHaveBeenCalledWith(WORKSPACE, JWT_USER, "en", tx);
    expect(saved).toBe("en");
  });
});
