import { describe, expect, it } from "vitest";

import { resolveClientLocale, resolveLocale } from "./locales";

describe("resolveLocale", () => {
  it("un cookie NEXT_LOCALE=de retombe sur fr", () => {
    const input = { cookie: "de", acceptLanguage: null };

    const locale = resolveLocale(input);

    expect(locale).toBe("fr");
  });

  it("sans cookie, Accept-Language en-US donne en", () => {
    const input = { cookie: undefined, acceptLanguage: "en-US,en;q=0.9" };

    const locale = resolveLocale(input);

    expect(locale).toBe("en");
  });

  it("cookie en l'emporte sur Accept-Language fr", () => {
    const input = { cookie: "en", acceptLanguage: "fr-BE,fr;q=0.9" };

    const locale = resolveLocale(input);

    expect(locale).toBe("en");
  });

  it("prend la première langue supportée d'Accept-Language", () => {
    const input = {
      cookie: undefined,
      acceptLanguage: "de-DE,de;q=0.9,en;q=0.8",
    };

    const locale = resolveLocale(input);

    expect(locale).toBe("en");
  });

  it("sans cookie ni Accept-Language donne fr", () => {
    const input = { cookie: undefined, acceptLanguage: null };

    const locale = resolveLocale(input);

    expect(locale).toBe("fr");
  });
  it("fr;q=0.5,en;q=0.9 donne en", () => {
    const input = { cookie: undefined, acceptLanguage: "fr;q=0.5,en;q=0.9" };

    const locale = resolveLocale(input);

    expect(locale).toBe("en");
  });

  it("* seul donne fr", () => {
    const input = { cookie: undefined, acceptLanguage: "*" };

    const locale = resolveLocale(input);

    expect(locale).toBe("fr");
  });

  it("en;q=0 donne fr", () => {
    const input = { cookie: undefined, acceptLanguage: "en;q=0" };

    const locale = resolveLocale(input);

    expect(locale).toBe("fr");
  });

  it("un cookie NEXT_LOCALE=EN est normalisé en en", () => {
    const input = { cookie: "EN", acceptLanguage: null };

    const locale = resolveLocale(input);

    expect(locale).toBe("en");
  });
});

describe("resolveClientLocale (page d'erreur globale, hors du fournisseur next-intl)", () => {
  it("prend la langue de <html lang>, posée par le layout racine depuis la langue enregistrée", () => {
    const input = { documentLang: "en", languages: ["fr-BE"] };

    const locale = resolveClientLocale(input);

    expect(locale).toBe("en");
  });

  it("sans <html lang> valable, suit les langues du navigateur", () => {
    const input = { documentLang: "", languages: ["de-DE", "en-US"] };

    const locale = resolveClientLocale(input);

    expect(locale).toBe("en");
  });

  it("sans rien d'exploitable, retombe sur fr", () => {
    const input = { documentLang: "de", languages: [] };

    const locale = resolveClientLocale(input);

    expect(locale).toBe("fr");
  });
});
