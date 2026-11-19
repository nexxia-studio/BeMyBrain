import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { DueDateChip } from "./DueDateChip";

const TODAY = "2026-11-19";

function openChip(locale: "fr" | "en", date: string | null) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone="UTC"
    >
      <DueDateChip
        today={TODAY}
        value={{ date, time: null }}
        onChange={vi.fn()}
        disabled={false}
      />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^(Échéance|Due)/ }));
}

describe("pastille Date : champ « Choisir… »", () => {
  it("affiche la date retenue dans la langue de l'app, reliée au champ natif", async () => {
    openChip("fr", "2026-11-28");

    const field = await screen.findByLabelText("Choisir…");
    const shown = screen.getByText("sam. 28 nov. 2026");

    expect(field.getAttribute("aria-describedby")).toBe(shown.id);
  });

  it("en anglais : « Sat, Nov 28, 2026 »", async () => {
    openChip("en", "2026-11-28");

    await screen.findByLabelText(en.tasks.quickAdd.date.pick);

    expect(screen.getByText("Sat, Nov 28, 2026")).toBeTruthy();
  });

  it("aucune date : rien d'affiché à côté du champ", async () => {
    openChip("fr", null);

    const field = await screen.findByLabelText("Choisir…");

    expect(field.getAttribute("aria-describedby")).toBeNull();
  });
});
