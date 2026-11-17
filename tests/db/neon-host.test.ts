// @vitest-environment node
import { describe, expect, it } from "vitest";

import { normalizeNeonHost as fromGuard } from "@/db/production-guard";

import { normalizeNeonHost as shared } from "../../scripts/neon-host.mjs";

// vitest.config.mts et src/db/production-guard.ts importent tous deux scripts/neon-host.mjs :
// une seule implémentation, vérifiée ici sur les cas qui comptent.
const CASES: Array<[string, string]> = [
  [
    "ep-abc-123-pooler.eu-central-1.db.example.test",
    "ep-abc-123.eu-central-1.db.example.test",
  ],
  [
    "EP-ABC-123.EU-CENTRAL-1.db.example.test",
    "ep-abc-123.eu-central-1.db.example.test",
  ],
  [
    "ep-abc-123.eu-central-1.db.example.test:5432",
    "ep-abc-123.eu-central-1.db.example.test",
  ],
  [
    "Ep-Abc-123-Pooler.eu-central-1.db.example.test:5432",
    "ep-abc-123.eu-central-1.db.example.test",
  ],
];

describe("normalisation de l'hôte Neon", () => {
  it.each(CASES)(
    "%s → %s, même résultat pour la config Vitest et le garde-fou",
    (input, expected) => {
      const results = [shared(input), fromGuard(input)];

      expect(results).toEqual([expected, expected]);
    },
  );

  it("le garde-fou réutilise la fonction partagée", () => {
    const same = fromGuard === shared;

    expect(same).toBe(true);
  });
});
