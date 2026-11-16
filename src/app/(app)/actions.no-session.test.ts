// @vitest-environment node
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { describe, expect, it, vi } from "vitest";

// Test réel (même principe que settings/actions.no-session.test.ts) : vraie requireSessionWithToken, vrai
// redirect de Next ; seule la lecture du jeton est simulée (aucun cookie de session).
const getSessionToken = vi.hoisted(() => vi.fn(async () => null));
const resolveMembership = vi.hoisted(() => vi.fn());
const runActionWithToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ getSessionToken }));
vi.mock("@/modules/core/membership", () => ({ resolveMembership }));
vi.mock("@/modules/actions/run", () => ({ runActionWithToken }));

import { runAction } from "./actions";

describe("runAction sans session", () => {
  it("est refusée par une redirection vers /login, sans lancer d'action", async () => {
    const error = await runAction("core.setLocale", { locale: "en" }).catch(
      (reason: unknown) => reason,
    );

    expect(isRedirectError(error)).toBe(true);
    expect((error as { digest: string }).digest).toContain(";/login;");
    expect(resolveMembership).not.toHaveBeenCalled();
    expect(runActionWithToken).not.toHaveBeenCalled();
  });
});
