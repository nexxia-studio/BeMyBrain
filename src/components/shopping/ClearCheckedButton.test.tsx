import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const clearCheckedShoppingItems = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/lists/shopping/actions", () => ({
  clearCheckedShoppingItems,
}));

import { ClearCheckedButton } from "./ClearCheckedButton";

function renderButton(count: number) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ClearCheckedButton count={count} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe("ClearCheckedButton", () => {
  it("le bouton n'existe que s'il y a des cochés", () => {
    const { container, rerender } = renderButton(0);
    expect(container.innerHTML).toBe("");
    rerender(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <ClearCheckedButton count={3} />
      </NextIntlClientProvider>,
    );
    const button = screen.getByRole("button", {
      name: "Vider les cochés (3)",
    });
    expect(button.classList.contains("min-h-11")).toBe(true);
  });

  it("la confirmation précède la suppression", async () => {
    clearCheckedShoppingItems.mockResolvedValue({ ok: true, result: null });
    renderButton(2);
    fireEvent.click(screen.getByRole("button", { name: /Vider les cochés/ }));

    const dialog = await screen.findByRole("dialog", {
      name: "Vider les cochés ?",
    });
    expect(dialog.textContent).toMatch(
      /Ces 2 articles cochés seront supprimés définitivement/,
    );
    expect(clearCheckedShoppingItems).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Supprimer" }),
      );
    });
    expect(clearCheckedShoppingItems).toHaveBeenCalledTimes(1);
  });

  it("« Annuler » ferme sans rien supprimer", async () => {
    renderButton(2);
    fireEvent.click(screen.getByRole("button", { name: /Vider les cochés/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(clearCheckedShoppingItems).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("l'échec garde la confirmation ouverte avec « Pas enregistré »", async () => {
    clearCheckedShoppingItems.mockResolvedValue({ ok: false });
    renderButton(1);
    fireEvent.click(screen.getByRole("button", { name: /Vider les cochés/ }));
    const dialog = await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Supprimer" }),
      );
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Pas enregistré/,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("une action qui lève affiche aussi l'échec", async () => {
    clearCheckedShoppingItems.mockRejectedValue(new Error("panne"));
    renderButton(1);
    fireEvent.click(screen.getByRole("button", { name: /Vider les cochés/ }));
    const dialog = await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Supprimer" }),
      );
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Pas enregistré/,
    );
  });
});
