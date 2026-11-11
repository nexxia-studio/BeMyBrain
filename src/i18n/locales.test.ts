import { describe, expect, it } from "vitest";

import { resolveLocale } from "./locales";

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
});
