import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const setContextSelection = vi.hoisted(() => vi.fn());

vi.mock("@/lib/preferences-actions", () => ({ setContextSelection }));

import { ContextFilter } from "./ContextFilter";

const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

function renderFilter(selected: string[]) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ContextFilter
        side="pro"
        contexts={[TRUSTUP, NEXXIA]}
        selected={selected}
      />
    </NextIntlClientProvider>,
  );
}

function pressed(name: string) {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

beforeEach(() => {
  vi.clearAllMocks();
  setContextSelection.mockResolvedValue(undefined);
});

describe("filtre d'espace de la barre latérale", () => {
  it("propose chaque contexte du workspace et « Les deux », actif quand tout est sélectionné", () => {
    renderFilter([TRUSTUP.id, NEXXIA.id]);

    expect(pressed("Les deux")).toBe("true");
    expect(pressed("Trustup")).toBe("false");
    expect(pressed("Nexxia")).toBe("false");
  });

  it("marque le seul contexte retenu", () => {
    renderFilter([NEXXIA.id]);

    expect(pressed("Nexxia")).toBe("true");
    expect(pressed("Les deux")).toBe("false");
  });

  it("enregistre le contexte choisi", () => {
    renderFilter([TRUSTUP.id, NEXXIA.id]);

    fireEvent.click(screen.getByRole("button", { name: "Nexxia" }));

    expect(setContextSelection).toHaveBeenCalledWith("pro", [NEXXIA.id]);
  });

  it("revient à tous les contextes avec « Les deux »", () => {
    renderFilter([NEXXIA.id]);

    fireEvent.click(screen.getByRole("button", { name: "Les deux" }));

    expect(setContextSelection).toHaveBeenCalledWith("pro", null);
  });

  it("revient à l'état enregistré et affiche un message si l'enregistrement échoue", async () => {
    setContextSelection.mockRejectedValue(new Error("réseau"));
    renderFilter([TRUSTUP.id, NEXXIA.id]);

    fireEvent.click(screen.getByRole("button", { name: "Nexxia" }));

    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      messages.shell.preferenceError,
    );
    await waitFor(() => expect(pressed("Les deux")).toBe("true"));
    expect(pressed("Nexxia")).toBe("false");
  });

  it("efface le message d'échec au geste suivant", async () => {
    setContextSelection.mockRejectedValueOnce(new Error("réseau"));
    renderFilter([TRUSTUP.id, NEXXIA.id]);
    fireEvent.click(screen.getByRole("button", { name: "Nexxia" }));
    await screen.findByText(messages.shell.preferenceError);

    fireEvent.click(screen.getByRole("button", { name: "Trustup" }));

    expect(screen.queryByText(messages.shell.preferenceError)).toBeNull();
  });
});
