import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CaughtBoundary,
  expiredSessionRedirect,
} from "../../../tests/factories/next-control";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const setTasksView = vi.hoisted(() => vi.fn());

vi.mock("@/lib/preferences-actions", () => ({ setTasksView }));

import { ViewSwitch } from "./ViewSwitch";

function renderSwitch(view: "list" | "board", locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <ViewSwitch view={view} />
    </NextIntlClientProvider>,
  );
}

function pressed(name: string) {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

beforeEach(() => {
  vi.clearAllMocks();
  setTasksView.mockResolvedValue(undefined);
});

describe("sélecteur de vue Liste / Tableau", () => {
  it("vue Liste enregistrée : « Liste » pressé, « Tableau » non", () => {
    renderSwitch("list");

    expect(pressed("Liste")).toBe("true");
    expect(pressed("Tableau")).toBe("false");
  });

  it("vue Tableau enregistrée : « Tableau » pressé, « Liste » non", () => {
    renderSwitch("board");

    expect(pressed("Tableau")).toBe("true");
    expect(pressed("Liste")).toBe("false");
  });

  it("groupe nommé, pour les lecteurs d'écran", () => {
    renderSwitch("list");

    expect(screen.getByRole("group", { name: "Vue" })).toBeTruthy();
  });

  it("un clic sur « Tableau » enregistre la vue board et la montre tout de suite", () => {
    renderSwitch("list");

    fireEvent.click(screen.getByRole("button", { name: "Tableau" }));

    expect(pressed("Tableau")).toBe("true");
    expect(setTasksView).toHaveBeenCalledTimes(1);
    expect(setTasksView).toHaveBeenCalledWith("board");
  });

  it("un clic sur la vue déjà affichée n'envoie rien au serveur", () => {
    renderSwitch("list");

    fireEvent.click(screen.getByRole("button", { name: "Liste" }));

    expect(setTasksView).not.toHaveBeenCalled();
  });

  it("aria-busy pendant l'enregistrement, retiré ensuite", async () => {
    let finish: () => void = () => {};
    setTasksView.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderSwitch("list");
    const group = screen.getByRole("group", { name: "Vue" });

    fireEvent.click(screen.getByRole("button", { name: "Tableau" }));

    expect(group.getAttribute("aria-busy")).toBe("true");
    await act(async () => finish());
    await waitFor(() => expect(group.getAttribute("aria-busy")).toBe("false"));
  });

  it("échec de l'enregistrement : message visible et retour à la vue enregistrée", async () => {
    setTasksView.mockRejectedValue(new Error("réseau"));
    renderSwitch("list");

    fireEvent.click(screen.getByRole("button", { name: "Tableau" }));

    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      fr.shell.preferenceError,
    );
    await waitFor(() => expect(pressed("Liste")).toBe("true"));
  });

  it("session expirée : laisse Next naviguer vers /login, sans message d'échec", async () => {
    const control = expiredSessionRedirect();
    setTasksView.mockRejectedValue(control);
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <CaughtBoundary onError={onError}>
        <NextIntlClientProvider locale="fr" messages={fr}>
          <ViewSwitch view="list" />
        </NextIntlClientProvider>
      </CaughtBoundary>,
    );
    const status = screen.getByRole("status");

    fireEvent.click(screen.getByRole("button", { name: "Tableau" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(control));
    expect(status.textContent).toBe("");
    consoleError.mockRestore();
  });

  it("zones tactiles d'au moins 44 px", () => {
    renderSwitch("list");

    for (const button of screen.getAllByRole("button")) {
      expect(button.classList.contains("min-h-11")).toBe(true);
      expect(button.classList.contains("min-w-11")).toBe(true);
    }
  });

  it("en anglais : « List » et « Board »", () => {
    renderSwitch("board", "en");

    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
    expect(pressed("Board")).toBe("true");
    expect(pressed("List")).toBe("false");
  });
});
