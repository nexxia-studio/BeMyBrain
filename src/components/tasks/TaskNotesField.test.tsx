import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { TaskNotesField } from "./TaskNotesField";

type HarnessProps = {
  initial: string;
  onBlur?: () => void;
  disabled?: boolean;
  errors?: { id: string; text: string }[];
};

function Harness({ initial, onBlur, disabled, errors }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <TaskNotesField
      value={value}
      onChange={setValue}
      onBlur={onBlur}
      disabled={disabled}
      errors={errors}
    />
  );
}

function renderField(props: HarnessProps, locale: "fr" | "en" = "fr") {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
}

const field = (name = "Notes") =>
  screen.getByRole("textbox", { name }) as HTMLTextAreaElement;
const classes = () => field().className.split(/\s+/);

afterEach(cleanup);

describe("champ de notes repliable", () => {
  it("vide : un vrai champ sur une ligne de 44 px, libellé « Notes », invite « Ajouter une note »", () => {
    renderField({ initial: "" });

    expect(field().tagName).toBe("TEXTAREA");
    expect(field().getAttribute("data-collapsed")).toBe("true");
    expect(field().rows).toBe(1);
    expect(field().placeholder).toBe("Ajouter une note");
    expect(classes()).toContain("min-h-11");
    expect(classes()).not.toContain("min-h-24");
    // Libellé visible, jamais le texte d'invite seul (DESIGN.md § 5, Champs).
    expect(screen.getByText("Notes", { selector: "label" })).toBeTruthy();
  });

  it("au focus : le même champ s'agrandit, et reste déplié au départ même resté vide (rien ne bouge sous le pointeur)", () => {
    renderField({ initial: "" });
    const before = field();

    fireEvent.focus(before);

    expect(field()).toBe(before);
    expect(field().getAttribute("data-collapsed")).toBe("false");
    expect(classes()).toContain("min-h-24");

    fireEvent.blur(field());

    expect(field().getAttribute("data-collapsed")).toBe("false");
    expect(classes()).toContain("min-h-24");
    expect(field().rows).toBe(3);
  });

  it("rempli : déplié, sans focus", () => {
    renderField({ initial: "Appeler avant midi" });

    expect(field().value).toBe("Appeler avant midi");
    expect(field().getAttribute("data-collapsed")).toBe("false");
    expect(classes()).toContain("min-h-24");
    expect(classes()).toContain("field-sizing-content");
  });

  it("saisie puis départ : reste déplié, texte gardé tel quel", () => {
    renderField({ initial: "" });

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "  Penser au devis " } });
    fireEvent.blur(field());

    expect(field().getAttribute("data-collapsed")).toBe("false");
    expect(field().value).toBe("  Penser au devis ");
  });

  it("des espaces seuls comptent pour vide : au départ le champ redevient vide et montre l'invite", () => {
    const onBlur = vi.fn();
    renderField({ initial: "", onBlur });

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "   " } });
    fireEvent.blur(field());

    expect(field().value).toBe("");
    // L'invite n'est affichée par le navigateur que sur une valeur vide.
    expect(field().placeholder).toBe("Ajouter une note");
    expect(field().matches(":placeholder-shown")).toBe(true);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("des espaces seuls reçus à l'ouverture : replié, comme vide", () => {
    renderField({ initial: "   " });

    expect(field().getAttribute("data-collapsed")).toBe("true");
  });

  it("prévient l'appelant au départ du champ", () => {
    const onBlur = vi.fn();
    renderField({ initial: "Appeler", onBlur });

    fireEvent.focus(field());
    fireEvent.blur(field());

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("désactivé pendant l'appel ; erreur sous le champ, reliée par aria-describedby", () => {
    renderField({
      initial: "Appeler",
      disabled: true,
      errors: [{ id: "notes-error", text: "Modification non enregistrée." }],
    });

    expect(field().disabled).toBe(true);
    expect(field().getAttribute("aria-describedby")).toBe("notes-error");
    expect(screen.getByRole("alert").textContent).toBe(
      "Modification non enregistrée.",
    );
  });

  it("en anglais : « Notes », « Add a note »", () => {
    renderField({ initial: "" }, "en");

    expect(field("Notes").placeholder).toBe("Add a note");
  });
});
