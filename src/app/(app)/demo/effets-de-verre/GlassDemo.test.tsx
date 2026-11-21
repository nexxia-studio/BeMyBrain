import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIGNATURE_KEYS } from "@/components/signature/signature-keys";

import messages from "../../../../../messages/fr.json";
import { GlassDemo } from "./GlassDemo";

const assign = vi.fn();

function renderDemo() {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <GlassDemo />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("démo des effets de verre", () => {
  it("« Revoir le reflet » efface toutes les clés de moments et seulement elles", () => {
    for (const key of SIGNATURE_KEYS) sessionStorage.setItem(key, "1");
    sessionStorage.setItem("autre_cle", "garde");
    renderDemo();

    fireEvent.click(screen.getByRole("button", { name: "Revoir le reflet" }));

    for (const key of SIGNATURE_KEYS) {
      expect(sessionStorage.getItem(key)).toBeNull();
    }
    expect(sessionStorage.getItem("autre_cle")).toBe("garde");
  });

  it("« Revoir le reflet » ouvre /dashboard par un chargement complet", () => {
    renderDemo();

    fireEvent.click(screen.getByRole("button", { name: "Revoir le reflet" }));

    expect(assign).toHaveBeenCalledWith("/dashboard");
  });

  it("propose les deux chargements ralentis", () => {
    renderDemo();

    expect(
      screen
        .getByRole("link", { name: "Tableau de bord, chargement ralenti" })
        .getAttribute("href"),
    ).toBe("/demo/effets-de-verre/lent/tableau-de-bord");
    expect(
      screen
        .getByRole("link", { name: "Liste des tâches, chargement ralenti" })
        .getAttribute("href"),
    ).toBe("/demo/effets-de-verre/lent/taches");
  });
});
