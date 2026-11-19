import { describe, expect, it } from "vitest";

import { getUserTimeZone, todayIn } from "./time-zone";

describe("getUserTimeZone", () => {
  it("renvoie le fuseau de Bruxelles en tranche 1", () => {
    expect(getUserTimeZone()).toBe("Europe/Brussels");
  });
});

describe("todayIn", () => {
  const zone = getUserTimeZone();

  it("hiver : 23:30 heure de Bruxelles donne le jour même", () => {
    // 2026-01-15 23:30 CET = 22:30 UTC
    expect(todayIn(zone, new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-15");
  });

  it("hiver : 00:30 heure de Bruxelles donne le nouveau jour alors qu'UTC est encore la veille", () => {
    // 2026-01-16 00:30 CET = 2026-01-15 23:30 UTC
    expect(todayIn(zone, new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("été : 23:30 heure de Bruxelles donne le jour même", () => {
    // 2026-07-15 23:30 CEST = 21:30 UTC
    expect(todayIn(zone, new Date("2026-07-15T21:30:00Z"))).toBe("2026-07-15");
  });

  it("été : 00:30 heure de Bruxelles donne le nouveau jour alors qu'UTC est encore la veille", () => {
    // 2026-07-16 00:30 CEST = 2026-07-15 22:30 UTC
    expect(todayIn(zone, new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-16");
  });

  it("renvoie une date sur dix caractères, mois et jour sur deux chiffres", () => {
    expect(todayIn(zone, new Date("2026-03-02T12:00:00Z"))).toBe("2026-03-02");
  });

  it("dépend du fuseau passé, pas de celui de la machine", () => {
    const now = new Date("2026-01-15T23:30:00Z");
    expect(todayIn("UTC", now)).toBe("2026-01-15");
    expect(todayIn(zone, now)).toBe("2026-01-16");
  });
});
