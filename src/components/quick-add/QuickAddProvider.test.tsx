import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Plus, Receipt } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../messages/fr.json";
import { useOpenQuickAdd } from "./quick-add-context";
import type { QuickAddFormProps, QuickAddType } from "./quick-add-types";
import { QuickAddProvider, RELAY_RELEASE_MS } from "./QuickAddProvider";

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
      <QuickAddProvider
        types={TYPES}
        scope={{ side: "private", contexts: [], contextId: null }}
      >
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

  it("Fermer ferme le tiroir", async () => {
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("retient le dernier type utilisé d'une ouverture à l'autre", async () => {
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));
    fireEvent.click(screen.getByRole("button", { name: "Dépense" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));

    expect(
      (await screen.findByRole("button", { name: "Dépense" })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });
});

// Champ relais (essai iPhone, 2026-11-19) : iOS n'ouvre le clavier que pour un focus donné dans le geste.
function stubPointer(coarse: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: coarse && query === "(pointer: coarse)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

function TitleForm({ initialFocusRef }: QuickAddFormProps) {
  return <input ref={initialFocusRef} aria-label="titre" />;
}

// Type sans champ initial : le relais ne doit pas garder le focus pour autant.
function ButtonsForm() {
  return <button type="button">valider</button>;
}

let focusedInGesture: Element | null = null;

function GestureOpener() {
  const open = useOpenQuickAdd();
  return (
    <button
      type="button"
      onClick={() => {
        open();
        // Lu dans le geste, avant tout rendu de React.
        focusedInGesture = document.activeElement;
      }}
    >
      ouvrir
    </button>
  );
}

function renderWithForm(Form: QuickAddType["Form"]) {
  const utils = render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QuickAddProvider
        types={[{ key: "task", icon: Plus, Form, action: "tasks.create" }]}
        scope={{ side: "private", contexts: [], contextId: null }}
      >
        <GestureOpener />
      </QuickAddProvider>
    </NextIntlClientProvider>,
  );
  const trigger = screen.getByRole("button", { name: "ouvrir" });
  trigger.focus();
  return { ...utils, trigger };
}

function relay(): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>("[data-quick-add-relay]");
  if (!el) throw new Error("relais absent");
  return el;
}

describe("champ relais de l'ajout rapide (clavier iOS)", () => {
  beforeEach(() => {
    focusedInGesture = null;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("au toucher, le relais a le focus dans le geste, puis le titre une fois ouvert", async () => {
    stubPointer(true);
    renderWithForm(TitleForm);

    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));

    expect(focusedInGesture).toBe(relay());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("titre")),
    );
  });

  it("relais caché aux lecteurs d'écran, hors tabulation, sans zoom ni saut de page", () => {
    stubPointer(true);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    renderWithForm(TitleForm);

    const el = relay();
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.tabIndex).toBe(-1);
    expect(el.getAttribute("aria-label")).toBeNull();
    expect(el.readOnly).toBe(false);
    // 16 px (`text-base`, DESIGN.md « Champs ») ; dans la fenêtre, invisible, sans clic.
    for (const token of [
      "text-base",
      "fixed",
      "top-0",
      "left-0",
      "opacity-0",
      "pointer-events-none",
    ]) {
      expect(el.className.split(" ")).toContain(token);
    }

    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));

    const onRelay = focus.mock.contexts.indexOf(el);
    expect(onRelay).toBeGreaterThanOrEqual(0);
    expect(focus.mock.calls[onRelay]).toEqual([{ preventScroll: true }]);
  });

  it("fermé avant que le titre ait le focus : le relais rend le focus au déclencheur", async () => {
    stubPointer(true);
    const { trigger } = renderWithForm(TitleForm);

    fireEvent.click(trigger);
    expect(document.activeElement).toBe(relay());
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("type sans champ initial : le relais ne garde pas le focus", async () => {
    stubPointer(true);
    renderWithForm(ButtonsForm);

    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));

    await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).not.toBe(relay()));
  });

  it("le tiroir ne prend jamais le focus : le relais le rend au déclencheur", () => {
    stubPointer(true);
    vi.useFakeTimers({ toFake: ["setTimeout", "requestAnimationFrame"] });
    const { trigger } = renderWithForm(TitleForm);

    fireEvent.click(trigger);
    expect(document.activeElement).toBe(relay());
    act(() => vi.advanceTimersByTime(RELAY_RELEASE_MS));

    expect(document.activeElement).toBe(trigger);
  });

  it("déjà ouvert : le relais ne vole pas le focus du titre", async () => {
    stubPointer(true);
    const { trigger } = renderWithForm(TitleForm);
    fireEvent.click(trigger);
    const title = await screen.findByLabelText("titre");
    await waitFor(() => expect(document.activeElement).toBe(title));

    fireEvent.click(trigger);

    expect(document.activeElement).toBe(title);
  });

  it("ordinateur (pointeur fin) : aucun relais, focus sur le titre comme avant", async () => {
    stubPointer(false);
    const { trigger } = renderWithForm(TitleForm);

    fireEvent.click(trigger);

    expect(focusedInGesture).toBe(trigger);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("titre")),
    );
  });
});
