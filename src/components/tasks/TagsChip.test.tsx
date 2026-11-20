import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction: vi.fn() }));

import { TagsChip } from "./TagsChip";

function renderChip(
  locale: "fr" | "en",
  value: string[],
  emptyLabel: "label" | "none" = "none",
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
});
