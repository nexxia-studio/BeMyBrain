import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import fr from "../../../messages/fr.json";

import { TaskTitleField } from "./TaskTitleField";

function Harness({
  saved = "Relancer le devis",
  onSave,
  errors,
}: {
  saved?: string;
  onSave: (value: string) => void;
  errors?: { id: string; text: string }[];
}) {
  const [value, setValue] = useState(saved);
  return (
    <TaskTitleField
      value={value}
      onChange={setValue}
      onSave={onSave}
      errors={errors}
    />
  );
}

function renderField(props: Parameters<typeof Harness>[0]) {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
}

const field = () =>
  screen.getByRole("textbox", { name: "Titre" }) as HTMLTextAreaElement;

afterEach(cleanup);

describe("titre éditable d'un tap", () => {
  it("repère d'édition présent au repos, libellé réservé aux lecteurs d'écran, style de titre", () => {
    renderField({ onSave: vi.fn() });

    const label = screen.getByText("Titre", { selector: "label" });
    expect(label.classList.contains("sr-only")).toBe(true);
    expect(document.querySelector("svg.lucide-pencil")).not.toBeNull();
    const classes = field().className.split(/\s+/);
    expect(classes).toContain("font-heading");
    expect(classes).toContain("text-title");
    expect(classes).toContain("text-balance");
    expect(classes).toContain("hover:bg-pill-track");
    expect(classes).toContain("focus:bg-row");
  });

  it("Entrée enregistre une seule fois (Entrée puis départ du champ)", () => {
    const onSave = vi.fn();
    renderField({ onSave });

    field().focus();
    fireEvent.change(field(), { target: { value: "Relancer Trustup" } });
    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Relancer Trustup");
    expect(document.activeElement).not.toBe(field());
  });

  it("le départ du champ enregistre", () => {
    const onSave = vi.fn();
    renderField({ onSave });

    fireEvent.change(field(), { target: { value: "Autre" } });
    fireEvent.blur(field());

    expect(onSave).toHaveBeenCalledWith("Autre");
  });

  it("erreur sous le champ, reliée par aria-describedby", () => {
    renderField({
      onSave: vi.fn(),
      errors: [{ id: "title-error", text: "Le titre ne peut pas être vide." }],
    });

    expect(field().getAttribute("aria-describedby")).toBe("title-error");
    expect(screen.getByRole("alert").textContent).toBe(
      "Le titre ne peut pas être vide.",
    );
  });
});
