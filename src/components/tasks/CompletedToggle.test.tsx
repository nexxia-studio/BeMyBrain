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
});
