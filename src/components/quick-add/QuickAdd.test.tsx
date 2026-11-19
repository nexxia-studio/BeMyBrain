import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Plus, Receipt } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import fr from "../../../messages/fr.json";
import { QuickAdd } from "./QuickAdd";
import type {
  QuickAddFormProps,
  QuickAddScope,
  QuickAddType,
} from "./quick-add-types";

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

const SCOPE: QuickAddScope = {
  side: "pro",
  contexts: [{ id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" }],
  contextId: null,
};

const receivedProps = vi.hoisted(() => vi.fn());

function TaskForm({ scope, initialFocusRef, onClose }: QuickAddFormProps) {
  receivedProps({ scope, onClose });
  return (
    <>
      <button type="button">premier bouton</button>
      <input ref={initialFocusRef} aria-label="titre" />
      <p data-testid="form-task" />
    </>
  );
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
        scope={SCOPE}
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

describe("ajout rapide : formulaire et clavier", () => {
  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
  });

  it("donne au formulaire le côté et l'espace courants", () => {
    renderQuickAdd([TASK]);

    expect(receivedProps).toHaveBeenCalledWith(
      expect.objectContaining({ scope: SCOPE }),
    );
  });

  it("met le focus dans le champ désigné par le formulaire (clavier ouvert d'office)", async () => {
    renderQuickAdd([TASK]);

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "titre" }),
      ),
    );
  });

  it("le formulaire peut fermer l'ajout rapide", () => {
    const onOpenChange = vi.fn();
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <QuickAdd
          open
          onOpenChange={onOpenChange}
          types={[TASK]}
          typeKey="task"
          onTypeChange={vi.fn()}
          scope={SCOPE}
        />
      </NextIntlClientProvider>,
    );
    const props = receivedProps.mock.lastCall?.[0] as Pick<
      QuickAddFormProps,
      "onClose"
    >;

    act(() => props.onClose());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("remonte le tiroir de la hauteur du clavier (iOS)", () => {
    const listeners = new Set<() => void>();
    const viewport = {
      height: window.innerHeight,
      offsetTop: 0,
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    renderQuickAdd([TASK]);

    act(() => {
      viewport.height = window.innerHeight - 320;
      for (const listener of listeners) listener();
    });

    expect(
      screen.getByTestId("quick-add-viewport").style.paddingBottom,
    ).toBe("320px");
  });
});
