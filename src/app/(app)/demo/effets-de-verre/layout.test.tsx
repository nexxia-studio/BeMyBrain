import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../../messages/fr.json";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const requireSession = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const cookies = vi.hoisted(() => vi.fn(async () => cookieStore));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/session", () => ({ requireSession, requireSessionWithToken }));

import GlassDemoLayout from "./layout";

const children = <p>contenu</p>;

async function renderLayout() {
  const tree = await GlassDemoLayout({ children });
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      {tree}
    </NextIntlClientProvider>,
  );
  return screen.getByTestId("frost-level");
}

function frostVars(envelope: HTMLElement) {
  return {
    from: envelope.style.getPropertyValue("--frost-from"),
    to: envelope.style.getPropertyValue("--frost-to"),
    rest: envelope.style.getPropertyValue("--frost-rest"),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("layout de la démo des effets de verre", () => {
  it("répond 404 en production Vercel, sans lire la session ni le cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(GlassDemoLayout({ children })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(requireSession).not.toHaveBeenCalled();
    expect(requireSessionWithToken).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  });

  it("répond 404 sur un build de production hors Vercel, sans lire la session ni le cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", undefined);

    await expect(GlassDemoLayout({ children })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(requireSession).not.toHaveBeenCalled();
    expect(requireSessionWithToken).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  });

  it("rend ses enfants dans l'enveloppe du cran sur une preview Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");

    const envelope = await renderLayout();

    expect(envelope.textContent).toBe("contenu");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("rend ses enfants en développement local", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", undefined);

    const envelope = await renderLayout();

    expect(envelope.textContent).toBe("contenu");
  });

  it("pose les variables du cran marqué lu dans le cookie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    cookieStore.get.mockReturnValue({ value: "strong" });

    const envelope = await renderLayout();

    expect(cookieStore.get).toHaveBeenCalledWith("glass-demo-frost");
    expect(frostVars(envelope)).toEqual({
      from: "color-mix(in srgb, var(--halo-blue), var(--primary) 30%)",
      to: "color-mix(in srgb, var(--halo-lilac), var(--primary) 30%)",
      rest: "0.65",
    });
  });

  it("pose les halos purs du cran discret", async () => {
    vi.stubEnv("NODE_ENV", "development");
    cookieStore.get.mockReturnValue({ value: "subtle" });

    const envelope = await renderLayout();

    expect(frostVars(envelope)).toEqual({
      from: "var(--halo-blue)",
      to: "var(--halo-lilac)",
      rest: "0.55",
    });
  });

  it("retombe sur le cran discret (celui de l'app) pour un cookie invalide", async () => {
    vi.stubEnv("NODE_ENV", "development");
    cookieStore.get.mockReturnValue({ value: "infinite;--x:red" });

    const envelope = await renderLayout();

    expect(frostVars(envelope)).toEqual({
      from: "var(--halo-blue)",
      to: "var(--halo-lilac)",
      rest: "0.55",
    });
  });

  it("retombe sur le cran discret sans cookie, et le réglage le montre choisi", async () => {
    vi.stubEnv("NODE_ENV", "development");
    cookieStore.get.mockReturnValue(undefined);

    const envelope = await renderLayout();

    expect(frostVars(envelope).rest).toBe("0.55");
    expect(
      screen
        .getByRole("button", { name: "Discret" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
