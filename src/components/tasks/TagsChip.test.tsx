import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { TagsChip } from "./TagsChip";

function renderChip(
  locale: "fr" | "en",
  value: string[],
  emptyLabel: "label" | "none" = "none",
  loadTags: () => Promise<string[] | null> = async () => [],
) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <TagsChip
        value={value}
        onChange={vi.fn()}
        disabled={false}
        emptyLabel={emptyLabel}
        loadTags={loadTags}
      />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("button", { name: /^Tags/ });
}

describe("pastille Tags", () => {
  it("vide : « Aucun » en encre secondaire, comme la pastille Espace", () => {
    const chip = renderChip("fr", []);

    expect(chip.textContent).toBe("Aucun");
    expect(chip.getAttribute("aria-label")).toBe("Tags : Aucun");
    expect(chip.className.split(/\s+/)).toContain("text-muted-foreground");
  });

  it("vide, sans ligne qui nomme le champ (ajout rapide) : « Tags », nom accessible inchangé", () => {
    const chip = renderChip("fr", [], "label");

    expect(chip.textContent).toBe("Tags");
    expect(chip.getAttribute("aria-label")).toBe("Tags : Aucun");
  });

  it("vide, en anglais : « None »", () => {
    const chip = renderChip("en", []);

    expect(chip.textContent).toBe("None");
    expect(chip.getAttribute("aria-label")).toBe("Tags: None");
  });

  it("avec des tags : leurs noms séparés selon la langue, en encre principale", () => {
    const chip = renderChip("fr", ["client", "maison"]);

    expect(chip.textContent).toBe("client et maison");
    expect(chip.getAttribute("aria-label")).toBe("Tags : client et maison");
    expect(chip.className.split(/\s+/)).toContain("text-foreground");
  });

  it("avec des tags, en anglais : virgules seules", () => {
    const chip = renderChip("en", ["client", "home"]);

    expect(chip.textContent).toBe("client, home");
  });

  it("lit les tags par le chargeur reçu, à la première ouverture seulement", async () => {
    const loadTags = vi.fn(async () => ["client", "maison"]);
    const chip = renderChip("fr", [], "none", loadTags);

    fireEvent.click(chip);

    expect(
      await screen.findByRole("button", { name: "maison", pressed: false }),
    ).toBeTruthy();
    expect(loadTags).toHaveBeenCalledOnce();
  });

  it("chargeur en échec : message, la création reste possible", async () => {
    const chip = renderChip("fr", [], "none", async () => null);

    fireEvent.click(chip);

    expect(
      await screen.findByText(fr.tasks.quickAdd.tags.loadFailed),
    ).toBeTruthy();
  });
});
