// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assertE2eTargetAllowed } from "./e2e-target.mjs";

const FORBIDDEN = "bemybrain.example.test, app.example.test";

describe("cible des e2e connectés", () => {
  it("refuse un hôte de production listé dans E2E_FORBIDDEN_HOSTS, sans citer l'hôte", () => {
    const check = () =>
      assertE2eTargetAllowed("https://bemybrain.example.test", FORBIDDEN);

    expect(check).toThrow(/E2E_BASE_URL.*E2E_FORBIDDEN_HOSTS/);
    expect(check).not.toThrow(/example/);
  });

  it("refuse aussi un sous-domaine d'un domaine listé, quelle que soit la casse", () => {
    const check = () =>
      assertE2eTargetAllowed(
        "https://WWW.App.Example.test/dashboard",
        FORBIDDEN,
      );

    expect(check).toThrow(/E2E_FORBIDDEN_HOSTS/);
  });

  it("autorise une preview hors de la liste", () => {
    const check = () =>
      assertE2eTargetAllowed(
        "https://bemybrain-git-feat-socle.example.test",
        FORBIDDEN,
      );

    expect(check).not.toThrow();
  });

  it("autorise le serveur local sans liste", () => {
    const check = () =>
      assertE2eTargetAllowed("http://localhost:3100", undefined);

    expect(check).not.toThrow();
  });

  it("ignore les entrées vides de la liste", () => {
    const check = () => assertE2eTargetAllowed("http://localhost:3000", " , ,");

    expect(check).not.toThrow();
  });
});
