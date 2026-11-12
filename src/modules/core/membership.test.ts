// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const VERIFIED_USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const tx = vi.hoisted(() => ({}));
const getMembership = vi.hoisted(() => vi.fn());

// withUserDb simulé : fn reçoit le sub « vérifié » ; la vérification elle-même est testée dans src/db.
vi.mock("@/db/client", () => ({
  withUserDb: vi.fn(
    async (
      _token: string,
      fn: (t: unknown, identity: { userId: string }) => unknown,
    ) => fn(tx, { userId: VERIFIED_USER }),
  ),
}));
vi.mock("./queries", () => ({ getMembership }));

import { resolveMembership } from "./membership";

describe("resolveMembership", () => {
  it("lit l'appartenance du sub vérifié par withUserDb et le renvoie comme userId", async () => {
    getMembership.mockResolvedValue({ workspace: null, locale: null });

    const membership = await resolveMembership("eyJ.jwt.signe");

    expect(getMembership).toHaveBeenCalledWith(VERIFIED_USER, tx);
    expect(membership).toEqual({
      userId: VERIFIED_USER,
      workspace: null,
      locale: null,
    });
  });
});
