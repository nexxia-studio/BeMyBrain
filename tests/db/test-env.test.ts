// @vitest-environment node
import { describe, expect, it } from "vitest";

// Comparaisons booléennes : un échec n'affiche jamais d'URL.
describe("connexions en test", () => {
  it("les variables de la branche test sont définies", () => {
    const defined =
      Boolean(process.env.DATABASE_TEST_URL) &&
      Boolean(process.env.DATABASE_TEST_AUTHENTICATED_URL);

    expect(defined).toBe(true);
  });

  it("en test, DATABASE_URL vaut DATABASE_TEST_URL", () => {
    const same = process.env.DATABASE_URL === process.env.DATABASE_TEST_URL;

    expect(same).toBe(true);
  });

  it("en test, DATABASE_AUTHENTICATED_URL vaut DATABASE_TEST_AUTHENTICATED_URL", () => {
    const same =
      process.env.DATABASE_AUTHENTICATED_URL ===
      process.env.DATABASE_TEST_AUTHENTICATED_URL;

    expect(same).toBe(true);
  });
});
