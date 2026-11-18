// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const VERIFIED_USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const tx = vi.hoisted(() => ({}));
const getMembership = vi.hoisted(() => vi.fn());
// Classe du jeton refusé, telle que ré-exportée par @/db/client (la vraie est testée dans src/db).
const InvalidTokenError = vi.hoisted(
  () => class InvalidTokenError extends Error {},
);

// withUserDb simulé : fn reçoit le sub « vérifié » ; la vérification elle-même est testée dans src/db.
vi.mock("@/db/client", () => ({
  withUserDb: vi.fn(
    async (
      _token: string,
      fn: (t: unknown, identity: { userId: string }) => unknown,
    ) => fn(tx, { userId: VERIFIED_USER }),
  ),
  InvalidTokenError,
}));
vi.mock("./queries", () => ({ getMembership }));

import { isRejectedToken, resolveMembership } from "./membership";

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

describe("isRejectedToken", () => {
  it("reconnaît un jeton refusé par withUserDb (signature, expiration, iss, aud)", () => {
    const rejected = isRejectedToken(new InvalidTokenError());

    expect(rejected).toBe(true);
  });

  it.each([
    new Error("panne"),
    Object.assign(new Error("Jeton d'authentification invalide"), {
      name: "InvalidTokenError",
    }),
    null,
  ])("ne confond pas une autre erreur avec un jeton refusé (%s)", (error) => {
    const rejected = isRejectedToken(error);

    expect(rejected).toBe(false);
  });
});
