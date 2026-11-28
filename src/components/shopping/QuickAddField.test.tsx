import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const addShoppingItem = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/lists/shopping/actions", () => ({ addShoppingItem }));

import { QuickAddField } from "./QuickAddField";

function renderField() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QuickAddField />
    </NextIntlClientProvider>,
  );
}

const field = () =>
  screen.getByRole("textbox", {
    name: "Ajouter un article",
  }) as HTMLInputElement;

type Listener = () => void;

/** Faux `visualViewport` (modèle de `use-keyboard-inset.test.ts`). */
function fakeVisualViewport(height: number) {
  const listeners = new Map<string, Set<Listener>>();
  const viewport = {
    height,
    offsetTop: 0,
    addEventListener(type: string, l: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(l);
    },
    removeEventListener(type: string, l: Listener) {
      listeners.get(type)?.delete(l);
    },
    emit(type: string) {
      for (const l of listeners.get(type) ?? []) l();
    },
  };
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  return viewport;
}

afterEach(() => {
  addShoppingItem.mockReset();
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
  vi.unstubAllGlobals();
});

describe("QuickAddField", () => {
  it("Entrée ajoute l'article, vide le champ et garde le focus", async () => {
    addShoppingItem.mockResolvedValue({ ok: true, result: {} });
    renderField();
    field().focus();
    fireEvent.change(field(), { target: { value: "Lait" } });
    await act(async () => {
      fireEvent.submit(field().form!);
    });
    expect(addShoppingItem).toHaveBeenCalledWith("Lait");
    expect(field().value).toBe("");
    expect(document.activeElement).toBe(field());
    expect(field().readOnly).toBe(false);
  });

  it("un champ vide est ignoré", async () => {
    renderField();
    fireEvent.change(field(), { target: { value: "   " } });
    await act(async () => {
      fireEvent.submit(field().form!);
    });
    expect(addShoppingItem).not.toHaveBeenCalled();
  });

  it("80 caractères maximum", () => {
    renderField();
    expect(field().maxLength).toBe(80);
    expect(field().className).toContain("text-base");
  });

  it("le champ n'est ni remonté ni remplacé pendant l'ajout", async () => {
    let resolve!: (v: unknown) => void;
    addShoppingItem.mockReturnValue(new Promise((r) => (resolve = r)));
    renderField();
    const before = field();
    before.focus();
    fireEvent.change(before, { target: { value: "Pain" } });
    act(() => {
      fireEvent.submit(before.form!);
    });
    expect(field()).toBe(before);
    expect(before.readOnly).toBe(true);
    expect(before.disabled).toBe(false);
    expect(document.activeElement).toBe(before);
    await act(async () => resolve({ ok: true, result: {} }));
    expect(field()).toBe(before);
    expect(document.activeElement).toBe(before);
  });

  it("le bouton rend le focus au champ dans le geste", async () => {
    // Résolue en fin de test : une action en attente retient les transitions des tests suivants (gotcha).
    let resolve!: (v: unknown) => void;
    addShoppingItem.mockReturnValue(new Promise((r) => (resolve = r)));
    renderField();
    fireEvent.change(field(), { target: { value: "Riz" } });
    expect(document.activeElement).not.toBe(field());
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(document.activeElement).toBe(field());
    await act(async () => resolve({ ok: true, result: {} }));
  });

  it("affiche l'échec et garde la saisie", async () => {
    addShoppingItem.mockResolvedValue({ ok: false });
    renderField();
    fireEvent.change(field(), { target: { value: "Thé" } });
    await act(async () => {
      fireEvent.submit(field().form!);
    });
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Pas enregistré, réessaie.",
    );
    expect(field().value).toBe("Thé");
  });

  it("une panne de l'action donne le même message", async () => {
    addShoppingItem.mockRejectedValue(new Error("réseau"));
    renderField();
    fireEvent.change(field(), { target: { value: "Thé" } });
    await act(async () => {
      fireEvent.submit(field().form!);
    });
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Pas enregistré, réessaie.",
    );
  });

  it.each([
    ["list_full", "La liste est pleine (300 articles maximum)."],
    ["label_too_long", "Cet article est trop long (80 caractères maximum)."],
  ])("le refus %s a son message", async (code, text) => {
    addShoppingItem.mockResolvedValue({ ok: false, code });
    renderField();
    fireEvent.change(field(), { target: { value: "Thé" } });
    await act(async () => {
      fireEvent.submit(field().form!);
    });
    expect((await screen.findByRole("alert")).textContent).toBe(text);
  });
});

describe("QuickAddField collant", () => {
  it("garde le même nœud DOM entre deux rendus et pendant un ajout", async () => {
    addShoppingItem.mockResolvedValue({ ok: true, result: {} });
    const view = renderField();
    const before = field();
    view.rerender(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <QuickAddField />
      </NextIntlClientProvider>,
    );
    expect(field()).toBe(before);
    fireEvent.change(before, { target: { value: "Lait" } });
    await act(async () => {
      fireEvent.submit(before.form!);
    });
    expect(field()).toBe(before);
  });

  it("porte un libellé visible associé et un placeholder d'exemple", () => {
    renderField();
    const label = screen.getByText("Ajouter un article", { selector: "label" });
    expect(label.className).not.toContain("sr-only");
    expect(screen.getByLabelText("Ajouter un article")).toBe(field());
    expect(field().placeholder).toBe("Lait, pain…");
    expect(field().getAttribute("placeholder")).not.toBe(label.textContent);
  });

  it("est collé au-dessus de la barre d'onglets", () => {
    const { container } = renderField();
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("sticky")).toBe(true);
    expect(root.className).toContain("max-lg:bottom-tabbar-reserve");
  });
});

describe("QuickAddField et clavier", () => {
  it("clavier ouvert puis fermé : même nœud, focus, saisie gardée, bottom suivi", () => {
    const viewport = fakeVisualViewport(window.innerHeight);
    const { container } = renderField();
    const before = field();
    const form = container.querySelector("form") as HTMLFormElement;
    act(() => before.focus());
    fireEvent.change(before, { target: { value: "Lai" } });
    expect(form.style.bottom).toBe("");

    act(() => {
      viewport.height = window.innerHeight - 300;
      viewport.emit("resize");
    });
    act(() => viewport.emit("scroll"));
    expect(form.style.bottom).toBe("calc(300px + var(--space-grid))");
    expect(field()).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(field().value).toBe("Lai");

    act(() => {
      viewport.height = window.innerHeight;
      viewport.emit("resize");
    });
    expect(form.style.bottom).toBe("");
    expect(field()).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(field().value).toBe("Lai");
  });

  it("sans focus, aucune mesure : le bottom reste celui de la barre d'onglets", () => {
    const viewport = fakeVisualViewport(window.innerHeight);
    const { container } = renderField();
    act(() => {
      viewport.height = window.innerHeight - 300;
      viewport.emit("resize");
    });
    expect((container.querySelector("form") as HTMLElement).style.bottom).toBe(
      "",
    );
  });

  it("sur ordinateur (>= 1024 px), un faux clavier est ignoré même focalisé", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const viewport = fakeVisualViewport(window.innerHeight);
    const { container } = renderField();
    act(() => field().focus());
    act(() => {
      viewport.height = window.innerHeight - 300;
      viewport.emit("resize");
    });
    expect((container.querySelector("form") as HTMLElement).style.bottom).toBe(
      "",
    );
  });

  it("toucher l'icône « + » est relayé au champ (label associé)", () => {
    const { container } = renderField();
    const icon = container.querySelector("label[aria-hidden='true']")!;
    expect(icon.getAttribute("for")).toBe(field().id);
    expect(icon.className).toContain("cursor-text");
    // jsdom relaie le clic d'un <label> au champ mais ne le focalise pas (le navigateur, si) : on prouve le relais.
    const onClick = vi.fn();
    field().addEventListener("click", onClick);
    fireEvent.click(icon);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("est en bas d'écran (mt-auto) sur un calque nommé", () => {
    const { container } = renderField();
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("mt-auto")).toBe(true);
    expect(root.className).toContain("z-(--z-sticky)");
    expect(root.className).not.toMatch(/\bz-10\b/);
  });
});
