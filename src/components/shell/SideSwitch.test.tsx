import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const setSide = vi.hoisted(() => vi.fn());
const signatureRendered = vi.hoisted(() => vi.fn());

vi.mock("@/lib/preferences-actions", () => ({ setSide }));
// Le moment signature est chargé à la demande : on ne vérifie ici que s'il est monté.
vi.mock("next/dynamic", () => ({
  default: () =>
    function SignatureProbe() {
      signatureRendered();
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
});
