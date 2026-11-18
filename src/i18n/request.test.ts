// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import enErrors from "../../messages/errors/en.json";
import frErrors from "../../messages/errors/fr.json";
import fr from "../../messages/fr.json";

const cookieLocale = vi.hoisted(() => ({ value: "fr" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: cookieLocale.value }) }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("next-intl/server", () => ({
  getRequestConfig: (load: () => Promise<unknown>) => load,
}));

import loadRequestConfig from "./request";

type Loaded = { locale: string; messages: Record<string, unknown> };

async function load(locale: string): Promise<Loaded> {
  cookieLocale.value = locale;
  const config = await (
    loadRequestConfig as unknown as () => Promise<Loaded>
  )();
  return config;
}

describe("messages de la requête", () => {
  it("refusionne la section errors, rangée dans son propre fichier", async () => {
    const config = await load("fr");

    expect(config.messages.errors).toEqual(frErrors);
    expect(config.messages.app).toEqual(fr.app);
  });

  it("prend la section errors de la langue de la requête", async () => {
    const config = await load("en");

    expect(config.locale).toBe("en");
    expect(config.messages.errors).toEqual(enErrors);
  });
});
