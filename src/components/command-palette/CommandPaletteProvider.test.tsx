import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  CaughtBoundary,
  expiredSessionRedirect,
} from "../../../tests/factories/next-control";

const push = vi.hoisted(() => vi.fn());
const runAction = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ current: "/dashboard" }));
const openQuickAdd = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", async (importOriginal) => ({
  // redirect et unstable_rethrow réels : le renvoi vers /login d'une session expirée (QA-1).
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
  usePathname: () => pathname.current,
}));
vi.mock("@/app/(app)/actions", () => ({ runAction }));

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import type { CurrentScope } from "@/lib/context-filter";

import { CommandPaletteProvider } from "./CommandPaletteProvider";
import { PaletteTrigger } from "./PaletteTrigger";

const SCOPE: CurrentScope = {
  side: "pro",
  contexts: [
    { id: "c1", name: "Nexxia" },
    { id: "c2", name: "Viniz" },
  ],
  contextId: "c2",
};

// Coque de l'app : l'ajout rapide enveloppe la palette (« Nouvelle tâche » l'ouvre).
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <OpenQuickAddContext value={openQuickAdd}>
      <CommandPaletteProvider scope={SCOPE}>
        <PaletteTrigger label="déclencheur" className="">
          +
        </PaletteTrigger>
        {children}
      </CommandPaletteProvider>
    </OpenQuickAddContext>
  );
}

function renderPalette(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <Shell>{null}</Shell>
    </NextIntlClientProvider>,
  );
}

function pressShortcut(modifier: "metaKey" | "ctrlKey" = "metaKey") {
  fireEvent.keyDown(window, { key: "k", [modifier]: true });
}

function palette() {
  return screen.queryByRole("dialog", { name: fr.palette.title });
}

function command(name: string) {
  return screen.getByRole("option", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  pathname.current = "/dashboard";
});

function addTaskLabel(title: string, template = fr.palette.commands.addTask) {
  return template.replace("{title}", title);
}

describe("palette de commandes", () => {
  it("s'ouvre avec ⌘K et se referme avec ⌘K", async () => {
    renderPalette();

    pressShortcut();
    expect(await screen.findByRole("dialog")).toBeTruthy();
    pressShortcut();

    await waitFor(() => expect(palette()).toBeNull());
  });

  it("pose un voile scrim sous la palette ouverte, au calque overlay", async () => {
    renderPalette();

    pressShortcut();
    await screen.findByRole("dialog");

    const backdrop = [
      ...document.querySelectorAll<HTMLElement>('[role="presentation"]'),
    ].find((element) => element.classList.contains("bg-scrim"));
    expect(backdrop?.className).toContain("z-(--z-overlay)");
    expect(backdrop?.className).toContain("fixed");
    expect(backdrop?.className).toContain("inset-0");
  });

  it("s'ouvre avec Ctrl+K", async () => {
    renderPalette();

    pressShortcut("ctrlKey");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("s'ouvre par un déclencheur de la coque, recherche active", async () => {
    renderPalette();

    fireEvent.click(screen.getByRole("button", { name: "déclencheur" }));

    const search = await screen.findByRole("combobox", {
      name: fr.palette.search,
    });
    await waitFor(() => expect(document.activeElement).toBe(search));
  });

  it("propose la navigation et le passage à l'autre langue", async () => {
    renderPalette();

    pressShortcut();

    expect(
      await screen.findByRole("option", { name: fr.shell.home }),
    ).toBeTruthy();
    expect(command(fr.shell.settings)).toBeTruthy();
    expect(command(fr.palette.commands.switchLocale.en)).toBeTruthy();
    expect(
      screen.queryByRole("option", {
        name: fr.palette.commands.switchLocale.fr,
      }),
    ).toBeNull();
  });

  it("chercher « langue » ne garde que le changement de langue", async () => {
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");

    fireEvent.change(search, { target: { value: "langue" } });

    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: fr.shell.settings }),
      ).toBeNull(),
    );
    expect(command(fr.palette.commands.switchLocale.en)).toBeTruthy();
  });

  it("une saisie sans commande correspondante ne propose que l'ajout de la tâche", async () => {
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");

    fireEvent.change(search, { target: { value: "zzzz" } });

    await waitFor(() =>
      expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
        addTaskLabel("zzzz"),
      ]),
    );
  });

  it.each([
    ["fr", "langue", fr.palette.commands.switchLocale.en],
    ["fr", "réglages", fr.shell.settings],
    ["fr", "corbeille", fr.palette.commands.openTrash],
    ["en", "language", en.palette.commands.switchLocale.fr],
    ["en", "settings", en.shell.settings],
    ["en", "trash", en.palette.commands.openTrash],
  ] as const)(
    "(%s) chercher « %s » trouve la commande",
    async (locale, word, expected) => {
      renderPalette(locale);
      pressShortcut();
      const search = await screen.findByRole("combobox");

      fireEvent.change(search, { target: { value: word } });

      expect(
        await screen.findByRole("option", { name: expected }),
      ).toBeTruthy();
    },
  );

  it("saisie libre : le premier élément est Ajouter la tâche « … », en surbrillance", async () => {
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");

    fireEvent.change(search, { target: { value: "Payer la crèche" } });

    await waitFor(() => {
      const [first] = screen.getAllByRole("option");
      expect(first.textContent).toBe(addTaskLabel("Payer la crèche"));
      expect(first.hasAttribute("data-highlighted")).toBe(true);
    });
  });

  it("Entrée sur la saisie libre crée la tâche avec le côté et l'espace courants, puis se ferme", async () => {
    runAction.mockResolvedValue({ ok: true, result: { id: "t1" } });
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");
    fireEvent.change(search, { target: { value: "  Payer la crèche " } });
    await screen.findByRole("option", {
      name: addTaskLabel("Payer la crèche"),
    });

    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() =>
      expect(runAction).toHaveBeenCalledWith("tasks.create", {
        title: "Payer la crèche",
        side: "pro",
        context: "Viniz",
      }),
    );
    await waitFor(() => expect(palette()).toBeNull());
  });

  it("en anglais, l'ajout de la tâche est libellé en anglais", async () => {
    renderPalette("en");
    pressShortcut();
    const search = await screen.findByRole("combobox");

    fireEvent.change(search, { target: { value: "Pay" } });

    expect(
      await screen.findByRole("option", {
        name: addTaskLabel("Pay", en.palette.commands.addTask),
      }),
    ).toBeTruthy();
  });

  it("l'échec de l'ajout garde la palette ouverte et le dit", async () => {
    runAction.mockResolvedValue({ ok: false });
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");
    fireEvent.change(search, { target: { value: "Payer" } });

    fireEvent.click(
      await screen.findByRole("option", { name: addTaskLabel("Payer") }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("palette-status").textContent).toBe(
        fr.palette.error,
      ),
    );
    expect(palette()).not.toBeNull();
  });

  it("Nouvelle tâche ferme la palette et ouvre l'ajout rapide, sans passer par le registre", async () => {
    renderPalette();
    pressShortcut();

    fireEvent.click(
      await screen.findByRole("option", {
        name: fr.palette.commands.newTask,
      }),
    );

    expect(openQuickAdd).toHaveBeenCalledTimes(1);
    expect(runAction).not.toHaveBeenCalled();
    await waitFor(() => expect(palette()).toBeNull());
  });

  it.each([
    [fr.palette.commands.openTodo, "/tasks"],
    [fr.palette.commands.openTrash, "/tasks/trash"],
  ])("« %s » ouvre %s", async (name, href) => {
    renderPalette();
    pressShortcut();

    fireEvent.click(await screen.findByRole("option", { name }));

    expect(push).toHaveBeenCalledWith(href);
    await waitFor(() => expect(palette()).toBeNull());
  });

  it("l'aide clavier présente ↑↓, Entrée et Échap en touches <kbd>", async () => {
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");

    const hint = document.getElementById(
      search.getAttribute("aria-describedby") ?? "",
    );
    const keys = [...(hint?.querySelectorAll("kbd") ?? [])].map(
      (kbd) => kbd.textContent,
    );

    expect(keys).toEqual(["↑↓", "Entrée", "Échap"]);
    expect(hint?.textContent).toContain("pour choisir");
    hint?.querySelectorAll("kbd").forEach((kbd) => {
      expect(kbd.className).toContain("bg-chip-neutral");
    });
  });

  it("lance core.setLocale par la Server Action unique, puis se ferme", async () => {
    runAction.mockResolvedValue({ ok: true, result: "en" });
    renderPalette();
    pressShortcut();

    fireEvent.click(
      await screen.findByRole("option", {
        name: fr.palette.commands.switchLocale.en,
      }),
    );

    await waitFor(() => expect(palette()).toBeNull());
    expect(runAction).toHaveBeenCalledWith("core.setLocale", { locale: "en" });
  });

  it("Entrée lance la commande en surbrillance (après l'ajout de la tâche, premier)", async () => {
    runAction.mockResolvedValue({ ok: true, result: "en" });
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");
    fireEvent.change(search, { target: { value: "anglais" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    fireEvent.keyDown(search, { key: "ArrowDown" });

    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() =>
      expect(runAction).toHaveBeenCalledWith("core.setLocale", {
        locale: "en",
      }),
    );
  });

  it("désactive les commandes pendant l'appel", async () => {
    let resolve: (value: unknown) => void = () => {};
    runAction.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPalette();
    pressShortcut();
    const target = await screen.findByRole("option", {
      name: fr.palette.commands.switchLocale.en,
    });

    fireEvent.click(target);

    await waitFor(() =>
      expect(target.getAttribute("aria-disabled")).toBe("true"),
    );
    expect(screen.getByTestId("palette-status").textContent).toBe(
      fr.palette.pending,
    );
    await act(async () => resolve({ ok: true, result: "en" }));
  });

  it("en cas d'échec, reste ouverte et le dit", async () => {
    runAction.mockResolvedValue({ ok: false });
    renderPalette();
    pressShortcut();

    fireEvent.click(
      await screen.findByRole("option", {
        name: fr.palette.commands.switchLocale.en,
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("palette-status").textContent).toBe(
        fr.palette.error,
      ),
    );
    expect(palette()).not.toBeNull();
  });

  it("un rejet de l'appel est traité comme un échec", async () => {
    runAction.mockRejectedValue(new Error("réseau"));
    renderPalette();
    pressShortcut();

    fireEvent.click(
      await screen.findByRole("option", {
        name: fr.palette.commands.switchLocale.en,
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("palette-status").textContent).toBe(
        fr.palette.error,
      ),
    );
  });

  it("session expirée : laisse Next naviguer vers /login, sans message d'échec", async () => {
    const control = expiredSessionRedirect();
    runAction.mockRejectedValue(control);
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <CaughtBoundary onError={onError}>
        <NextIntlClientProvider locale="fr" messages={fr}>
          <Shell>{null}</Shell>
        </NextIntlClientProvider>
      </CaughtBoundary>,
    );
    pressShortcut();

    fireEvent.click(
      await screen.findByRole("option", {
        name: fr.palette.commands.switchLocale.en,
      }),
    );

    await waitFor(() => expect(onError).toHaveBeenCalledWith(control));
    expect(screen.queryByText(fr.palette.error)).toBeNull();
    consoleError.mockRestore();
  });

  it("navigue vers une section sans passer par le registre, puis se ferme", async () => {
    renderPalette();
    pressShortcut();

    fireEvent.click(
      await screen.findByRole("option", { name: fr.shell.settings }),
    );

    expect(push).toHaveBeenCalledWith("/settings");
    expect(runAction).not.toHaveBeenCalled();
    await waitFor(() => expect(palette()).toBeNull());
  });

  it("Échap ferme la palette et rend le focus au déclencheur", async () => {
    renderPalette();
    const trigger = screen.getByRole("button", { name: "déclencheur" });
    trigger.focus();
    fireEvent.click(trigger);
    const search = await screen.findByRole("combobox");
    await waitFor(() => expect(document.activeElement).toBe(search));

    fireEvent.keyDown(search, { key: "Escape" });

    await waitFor(() => expect(palette()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("est modale : le reste de la page est inerte pendant qu'elle est ouverte", async () => {
    renderPalette();

    pressShortcut();
    await screen.findByRole("dialog");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "déclencheur" })).toBeNull(),
    );
  });

  it("n'expose pas de bouton de fermeture invisible (Échap et clic dehors ferment)", async () => {
    renderPalette();

    pressShortcut();
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).queryAllByRole("button")).toEqual([]);
  });

  it("un seul anneau de focus : la rangée de recherche au focus, l'option en surbrillance au clavier (DESIGN.md § 11)", async () => {
    renderPalette();

    pressShortcut();
    const search = await screen.findByRole("combobox");
    const highlighted = await waitFor(() => {
      const option = screen
        .getAllByRole("option")
        .find((el) => el.hasAttribute("data-highlighted"));
      if (!option) throw new Error("aucune option en surbrillance");
      return option;
    });

    expect(search.className).toContain("outline-none");
    expect(search.parentElement?.className).toContain(
      "focus-within:border-ring",
    );
    expect(highlighted.className).toContain("data-highlighted:ring-2");
    expect(highlighted.className).toContain("data-highlighted:ring-ring");
    expect(highlighted.className).toContain(
      "pointer-coarse:data-highlighted:ring-0",
    );
  });

  it("signale la page courante dans « Aller à » (aria-current et pastille)", async () => {
    pathname.current = "/settings";
    renderPalette();
    pressShortcut();

    const current = await screen.findByRole("option", {
      name: fr.shell.settings,
    });

    expect(current.getAttribute("aria-current")).toBe("page");
    expect(within(current).getByText(fr.palette.current)).toBeTruthy();
    expect(command(fr.shell.home).hasAttribute("aria-current")).toBe(false);
  });

  it("en anglais, propose de passer en français", async () => {
    renderPalette("en");

    pressShortcut();

    expect(
      await screen.findByRole("option", {
        name: en.palette.commands.switchLocale.fr,
      }),
    ).toBeTruthy();
  });
});
