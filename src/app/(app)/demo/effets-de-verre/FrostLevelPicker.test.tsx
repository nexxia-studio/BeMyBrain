import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../../messages/fr.json";
import { FrostLevelPicker } from "./FrostLevelPicker";

const reload = vi.fn();
const cookieWrites: string[] = [];

function renderPicker() {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <FrostLevelPicker current="medium" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  cookieWrites.length = 0;
  vi.stubGlobal("location", { ...window.location, reload });
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "",
    set: (value: string) => cookieWrites.push(value),
  });
});

afterEach(() => {
  Reflect.deleteProperty(document, "cookie");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("réglage d'intensité du givre (démo)", () => {
  it("propose trois crans et montre le cran courant", () => {
    renderPicker();

    const group = screen.getByRole("group", { name: "Intensité du givre" });
    const pressed = [...group.querySelectorAll("button")].map((button) => [
      button.textContent,
      button.getAttribute("aria-pressed"),
    ]);
    expect(pressed).toEqual([
      ["Discret", "false"],
      ["Moyen", "true"],
      ["Marqué", "false"],
    ]);
  });

  it("écrit le cookie de démo du cran choisi puis recharge la page", () => {
    renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "Marqué" }));

    expect(cookieWrites).toEqual([
      "glass-demo-frost=strong; path=/demo/effets-de-verre; max-age=86400; samesite=lax",
    ]);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
