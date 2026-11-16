// @vitest-environment node
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { describe, expect, it, vi } from "vitest";

// Test réel (plan socle, tâche 16) : la vraie requireSession et le vrai redirect de Next, seule la lecture
// du jeton de session est simulée (aucun cookie de session). Les écritures sont espionnées.
// Couvre l'absence de jeton. Le cas « jeton invalide ou expiré » (signature, iss, aud, exp) est couvert par
// les tests de withUserDb (src/db/client.test.ts : signature, iss, aud, sub, expiration).
const getSessionToken = vi.hoisted(() => vi.fn(async () => null));
const saveMemberLocale = vi.hoisted(() => vi.fn());
const resolveMembership = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ getSessionToken }));
vi.mock("@/modules/core/membership", () => ({ resolveMembership }));
vi.mock("@/modules/core/locale", () => ({ saveMemberLocale }));
vi.mock("@/lib/locale-cookie", () => ({ syncLocaleCookie }));

import { setLocale } from "./actions";

describe("Server Action non publique", () => {
  it("une Server Action non publique appelée sans session est refusée", async () => {
    const error = await setLocale("en").catch((reason: unknown) => reason);

    expect(isRedirectError(error)).toBe(true);
    expect((error as { digest: string }).digest).toContain(";/login;");
    expect(resolveMembership).not.toHaveBeenCalled();
    expect(saveMemberLocale).not.toHaveBeenCalled();
    expect(syncLocaleCookie).not.toHaveBeenCalled();
  });
});
