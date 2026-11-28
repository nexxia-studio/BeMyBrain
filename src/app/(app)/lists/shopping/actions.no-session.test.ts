// @vitest-environment node
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { describe, expect, it, vi } from "vitest";

// Vraie requireSessionWithToken, vrai redirect de Next ; seule la lecture du jeton est simulée.
const getSessionToken = vi.hoisted(() => vi.fn(async () => null));
const resolveMembership = vi.hoisted(() => vi.fn());
const runActionWithToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ getSessionToken }));
vi.mock("@/modules/core/membership", () => ({ resolveMembership }));
vi.mock("@/modules/actions/run", () => ({ runActionWithToken }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      host: "bemybrain.test",
      "x-forwarded-proto": "https",
      "next-action": "408598b1af6ee1d3946827f5f62fd65e1f908928e8",
    }),
}));

import { checkShoppingItem } from "./actions";

describe("Server Actions des Courses sans session", () => {
  it("refuse par une redirection vers /login, sans lancer d'action", async () => {
    const error = await checkShoppingItem(
      "3c6d1f0e-8a2b-4c5d-9e7f-0a1b2c3d4e5f",
    ).catch((reason: unknown) => reason);

    expect(isRedirectError(error)).toBe(true);
    expect((error as { digest: string }).digest).toContain(";/login;");
    expect(runActionWithToken).not.toHaveBeenCalled();
  });
});
