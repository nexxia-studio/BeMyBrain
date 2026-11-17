import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const setSide = vi.hoisted(() => vi.fn());
const signatureRendered = vi.hoisted(() => vi.fn());
const loading = vi.hoisted(() => ({ importFails: false }));

vi.mock("@/lib/preferences-actions", () => ({ setSide }));
// Le moment signature est chargé à la demande : on ne vérifie ici que s'il est monté.
vi.mock("next/dynamic", () => ({
  default: () =>
    function SignatureProbe(props: { initialSide: string; side: string }) {
      // Morceau introuvable (ancien déploiement, 404) : next/dynamic rend une erreur.
      if (loading.importFails) throw new Error("ChunkLoadError");
      signatureRendered({ initialSide: props.initialSide, side: props.side });
      return null;
    },
}));

import { SideSwitch } from "./SideSwitch";

function renderSwitch(side: "private" | "pro") {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <SideSwitch side={side} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  loading.importFails = false;
  vi.clearAllMocks();
  sessionStorage.clear();
  setSide.mockResolvedValue(undefined);
});

describe("bascule Privé / Pro", () => {
  it("indique le côté actif par aria-pressed", () => {
    renderSwitch("pro");

    expect(
      screen.getByRole("button", { name: "Pro" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Privé" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("import du moment rejeté → la bascule reste affichée et fonctionne", () => {
    loading.importFails = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderSwitch("private");

    fireEvent.click(screen.getByRole("button", { name: "Pro" }));

    expect(setSide).toHaveBeenCalledWith("pro");
  });

  it("enregistre le côté choisi", () => {
    renderSwitch("private");

    fireEvent.click(screen.getByRole("button", { name: "Pro" }));

    expect(setSide).toHaveBeenCalledWith("pro");
  });

  it("ne renvoie rien au serveur quand on clique le côté déjà actif", () => {
    renderSwitch("private");

    fireEvent.click(screen.getByRole("button", { name: "Privé" }));

    expect(setSide).not.toHaveBeenCalled();
  });

  it("charge le moment signature tant qu'il n'a pas été joué dans la session", () => {
    renderSwitch("private");

    expect(signatureRendered).toHaveBeenCalled();
  });

  it("ne charge pas le moment signature déjà joué dans la session", () => {
    sessionStorage.setItem("bmb_signature_side_switch", "1");

    renderSwitch("private");

    expect(signatureRendered).not.toHaveBeenCalled();
  });

  it("transmet au moment signature le côté initial et le côté choisi", () => {
    renderSwitch("private");

    fireEvent.click(screen.getByRole("button", { name: "Pro" }));

    expect(signatureRendered).toHaveBeenLastCalledWith({
      initialSide: "private",
      side: "pro",
    });
  });

  it("revient au côté enregistré et affiche un message si l'enregistrement échoue", async () => {
    setSide.mockRejectedValue(new Error("réseau"));
    renderSwitch("private");

    fireEvent.click(screen.getByRole("button", { name: "Pro" }));

    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      messages.shell.preferenceError,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Privé" })
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
  });
});
