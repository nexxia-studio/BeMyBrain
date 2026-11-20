import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { CompletedToggle } from "./CompletedToggle";

function renderToggle(checked: boolean, href: string) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <CompletedToggle checked={checked} href={href} />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("switch", { name: "Terminées" });
}

afterEach(() => replace.mockReset());

describe("interrupteur Terminées", () => {
  it("éteint : l'allumer mène à l'adresse qui montre les terminées", () => {
    const toggle = renderToggle(false, "/tasks?completed=1");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(replace).toHaveBeenCalledWith("/tasks?completed=1", {
      scroll: false,
    });
  });

  it("allumé : l'éteindre revient à la liste sans paramètre", () => {
    const toggle = renderToggle(true, "/tasks");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(replace).toHaveBeenCalledWith("/tasks", { scroll: false });
  });

  it("éteint : la piste porte le bord des champs, pour rester visible sur le verre (≥ 3:1)", () => {
    const toggle = renderToggle(false, "/tasks?completed=1");

    const track = toggle.querySelector("[aria-hidden='true']");

    expect(track?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["border", "border-input", "bg-pill-track"]),
    );
  });

  it("allumé : la piste pleine en primary, sans bord", () => {
    const toggle = renderToggle(true, "/tasks");

    const classes = toggle
      .querySelector("[aria-hidden='true']")
      ?.className.split(/\s+/);

    expect(classes).toContain("bg-primary");
    expect(classes).not.toContain("border");
    expect(classes).not.toContain("border-input");
  });
});
