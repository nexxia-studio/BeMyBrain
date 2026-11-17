import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const setLocale = vi.hoisted(() => vi.fn());

vi.mock("@/app/(app)/settings/actions", () => ({ setLocale }));

import { LocalePicker } from "./LocalePicker";

function renderPicker(locale: "fr" | "en") {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <LocalePicker locale={locale} />
    </NextIntlClientProvider>,
  );
}

function option(name: string) {
  return screen.getByRole("button", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  setLocale.mockResolvedValue(undefined);
});

describe("choix de la langue", () => {
  it("indique la langue courante par aria-pressed, dans un groupe nommé", () => {
    renderPicker("fr");

    expect(screen.getByRole("group", { name: "Langue" })).toBeTruthy();
    expect(option("Français").getAttribute("aria-pressed")).toBe("true");
    expect(option("English").getAttribute("aria-pressed")).toBe("false");
  });

  it("enregistre la langue choisie et désactive les choix pendant l'appel", async () => {
    let finish: () => void = () => {};
    setLocale.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderPicker("fr");

    fireEvent.click(option("English"));

    expect(setLocale).toHaveBeenCalledWith("en");
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Langue" }).getAttribute("aria-busy"),
      ).toBe("true"),
    );
    expect((option("English") as HTMLButtonElement).disabled).toBe(true);
    expect((option("Français") as HTMLButtonElement).disabled).toBe(true);
    finish();
    await waitFor(() =>
      expect((option("English") as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("ne rappelle pas l'action pour la langue déjà choisie", () => {
    renderPicker("fr");

    fireEvent.click(option("Français"));

    expect(setLocale).not.toHaveBeenCalled();
  });

  it("affiche un message si l'enregistrement échoue", async () => {
    setLocale.mockRejectedValue(new Error("unavailable"));
    renderPicker("fr");

    fireEvent.click(option("English"));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Langue non enregistrée. Réessaie.",
      ),
    );
    expect(option("Français").getAttribute("aria-pressed")).toBe("true");
  });
});
