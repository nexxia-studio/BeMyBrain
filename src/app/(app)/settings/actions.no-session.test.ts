// @vitest-environment node
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { describe, expect, it, vi } from "vitest";

// Test réel (plan socle, tâche 16) : la vraie requireSession et le vrai redirect de Next, seule la lecture
// du jeton de session est simulée (aucun cookie de session). Les écritures sont espionnées.
// Couvre l'absence de jeton. Le refus d'un jeton invalide ou expiré est testé dans withUserDb
// (src/db/client.test.ts) et son renvoi vers /login dans src/lib/session.test.ts.
const getSessionToken = vi.hoisted(() => vi.fn(async () => null));
const saveMemberLocale = vi.hoisted(() => vi.fn());
const resolveMembership = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ getSessionToken }));
vi.mock("@/modules/core/membership", () => ({ resolveMembership }));
vi.mock("@/modules/core/locale", () => ({ saveMemberLocale }));
vi.mock("@/lib/locale-cookie", () => ({ syncLocaleCookie }));
// Appel de l'action depuis la page Réglages (en-têtes que le client de Next envoie).
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      host: "bemybrain.test",
      "x-forwarded-proto": "https",
      "next-action": "408598b1af6ee1d3946827f5f62fd65e1f908928e8",
      referer: "https://bemybrain.test/settings",
    }),
}));

import { setLocale } from "./actions";

describe("Server Action non publique", () => {
  it("une Server Action non publique appelée sans session est refusée", async () => {
    const error = await setLocale("en").catch((reason: unknown) => reason);

    expect(isRedirectError(error)).toBe(true);
    expect((error as { digest: string }).digest).toContain(
      ";/login?next=%2Fsettings;",
    );
    expect(resolveMembership).not.toHaveBeenCalled();
    expect(saveMemberLocale).not.toHaveBeenCalled();
    expect(syncLocaleCookie).not.toHaveBeenCalled();
  });
});
