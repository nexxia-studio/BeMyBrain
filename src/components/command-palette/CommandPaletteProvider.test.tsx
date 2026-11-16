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

const push = vi.hoisted(() => vi.fn());
const runAction = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/(app)/actions", () => ({ runAction }));

import { CommandPaletteProvider } from "./CommandPaletteProvider";
import { PaletteTrigger } from "./PaletteTrigger";

function renderPalette(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <CommandPaletteProvider>
        <PaletteTrigger label="déclencheur" className="">
          +
        </PaletteTrigger>
      </CommandPaletteProvider>
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
});

describe("palette de commandes", () => {
  it("s'ouvre avec ⌘K et se referme avec ⌘K", async () => {
    renderPalette();

    pressShortcut();
    expect(await screen.findByRole("dialog")).toBeTruthy();
    pressShortcut();

    await waitFor(() => expect(palette()).toBeNull());
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

  it("une recherche sans résultat le dit", async () => {
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");

    fireEvent.change(search, { target: { value: "zzzz" } });

    expect(await screen.findByText(fr.palette.empty)).toBeTruthy();
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

  it("Entrée lance la commande en surbrillance", async () => {
    runAction.mockResolvedValue({ ok: true, result: "en" });
    renderPalette();
    pressShortcut();
    const search = await screen.findByRole("combobox");
    fireEvent.change(search, { target: { value: "anglais" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));

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
      expect(
        screen.queryByRole("button", { name: "déclencheur" }),
      ).toBeNull(),
    );
  });

  it("n'expose pas de bouton de fermeture invisible (Échap et clic dehors ferment)", async () => {
    renderPalette();

    pressShortcut();
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).queryAllByRole("button")).toEqual([]);
  });

  it("l'option en surbrillance porte l'anneau de focus du token ring (DESIGN.md § 11)", async () => {
    renderPalette();

    pressShortcut();
    const highlighted = await waitFor(() => {
      const option = screen
        .getAllByRole("option")
        .find((el) => el.hasAttribute("data-highlighted"));
      if (!option) throw new Error("aucune option en surbrillance");
      return option;
    });

    expect(highlighted.className).toContain("data-highlighted:ring-2");
    expect(highlighted.className).toContain("data-highlighted:ring-ring");
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
