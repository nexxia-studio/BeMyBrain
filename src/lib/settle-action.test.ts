import { notFound, redirect } from "next/navigation";
import { describe, expect, it } from "vitest";

import { settleAction } from "./settle-action";

function thrownBy(control: () => never): unknown {
  try {
    control();
  } catch (error) {
    return error;
  }
}

describe("appel d'une Server Action depuis le client", () => {
  it("rend la valeur de l'action réussie", async () => {
    const outcome = await settleAction(async () => 42);

    expect(outcome).toEqual({ ok: true, value: 42 });
  });

  it("rend un échec quand l'action lève (panne, réponse inattendue)", async () => {
    const outcome = await settleAction(async () => {
      throw new Error("An unexpected response was received from the server.");
    });

    expect(outcome).toEqual({ ok: false });
  });

  it("laisse passer le renvoi vers /login (session expirée) pour que Next navigue", async () => {
    const control = thrownBy(() => redirect("/login?next=%2Fsettings"));

    const run = settleAction(async () => {
      throw control;
    });

    await expect(run).rejects.toBe(control);
  });

  it("laisse passer les autres erreurs de contrôle de Next (notFound)", async () => {
    const control = thrownBy(() => notFound());

    const run = settleAction(async () => {
      throw control;
    });

    await expect(run).rejects.toBe(control);
  });
});
