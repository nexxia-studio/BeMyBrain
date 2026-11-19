import { fireEvent, render, screen } from "@testing-library/react";
import { Plus, Receipt } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import fr from "../../../messages/fr.json";
import { useOpenQuickAdd } from "./quick-add-context";
import type { QuickAddType } from "./quick-add-types";
import { QuickAddProvider } from "./QuickAddProvider";

const messages = {
  ...fr,
  quickAdd: {
    ...fr.quickAdd,
    types: {
      ...fr.quickAdd.types,
      expense: { label: "Dépense", title: "Ajouter une dépense" },
    },
  },
};

const TYPES: readonly QuickAddType[] = [
  { key: "task", icon: Plus, Form: () => null, action: "tasks.create" },
  {
    key: "expense",
    icon: Receipt,
    Form: () => null,
    action: "finance.createExpense",
  },
];

function Opener() {
  const open = useOpenQuickAdd();
  return (
    <button type="button" onClick={open}>
      ouvrir
    </button>
  );
}

function renderProvider() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QuickAddProvider types={TYPES}>
        <Opener />
      </QuickAddProvider>
    </NextIntlClientProvider>,
  );
}

describe("fournisseur de l'ajout rapide", () => {
  it("fermé au départ, ouvert par la fonction partagée", () => {
    renderProvider();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("retient le dernier type utilisé d'une ouverture à l'autre", async () => {
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));
    fireEvent.click(screen.getByRole("button", { name: "Dépense" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await screen.findByRole("button", { name: "ouvrir" });

    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));

    expect(
      (await screen.findByRole("button", { name: "Dépense" })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });
});
