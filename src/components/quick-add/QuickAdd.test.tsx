import { fireEvent, render, screen, within } from "@testing-library/react";
import { Plus, Receipt } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../messages/fr.json";
import { QuickAdd } from "./QuickAdd";
import type { QuickAddType } from "./quick-add-types";

// Deuxième type factice (dépense) : ses libellés n'existent pas encore dans messages/*.json.
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

function TaskForm() {
  return <p data-testid="form-task" />;
}

function ExpenseForm() {
  return <p data-testid="form-expense" />;
}

const TASK: QuickAddType = {
  key: "task",
  icon: Plus,
  Form: TaskForm,
  action: "tasks.create",
};
const EXPENSE: QuickAddType = {
  key: "expense",
  icon: Receipt,
  Form: ExpenseForm,
  action: "finance.createExpense",
};

function renderQuickAdd(
  types: readonly QuickAddType[],
  typeKey = types[0].key,
  onTypeChange = vi.fn(),
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QuickAdd
        open
        onOpenChange={vi.fn()}
        types={types}
        typeKey={typeKey}
        onTypeChange={onTypeChange}
      />
    </NextIntlClientProvider>,
  );
}

describe("ajout rapide (coque)", () => {
  it("un seul type : pas de sélecteur, le formulaire du type est affiché", () => {
    renderQuickAdd([TASK]);

    const dialog = screen.getByRole("dialog", { name: "Ajouter une tâche" });
    expect(within(dialog).queryByRole("group")).toBeNull();
    expect(within(dialog).getByTestId("form-task")).toBeTruthy();
  });

  it("deux types factices : sélecteur visible, type courant pressé", () => {
    renderQuickAdd([TASK, EXPENSE], "expense");

    const group = screen.getByRole("group", { name: "Type d'ajout" });
    expect(
      within(group)
        .getByRole("button", { name: "Tâche" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      within(group)
        .getByRole("button", { name: "Dépense" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByTestId("form-expense")).toBeTruthy();
    expect(screen.queryByTestId("form-task")).toBeNull();
  });

  it("choisir un autre type le signale au parent", () => {
    const onTypeChange = vi.fn();
    renderQuickAdd([TASK, EXPENSE], "task", onTypeChange);

    fireEvent.click(screen.getByRole("button", { name: "Dépense" }));

    expect(onTypeChange).toHaveBeenCalledWith("expense");
  });

  it("type retenu inconnu : retombe sur le premier type déclaré", () => {
    renderQuickAdd([TASK, EXPENSE], "disparu");

    expect(screen.getByTestId("form-task")).toBeTruthy();
  });
});
