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

const setBoardOption = vi.hoisted(() => vi.fn());

vi.mock("@/lib/preferences-actions", () => ({ setBoardOption }));

import { BoardOptions } from "./BoardOptions";

const SUBTASKS = "Sous-tâches";
const HIDE_DONE = "Masquer les sous-tâches terminées";

function renderOptions(
  subtasks: boolean,
  hideDoneSubtasks: boolean,
  locale: "fr" | "en" = "fr",
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <BoardOptions subtasks={subtasks} hideDoneSubtasks={hideDoneSubtasks} />
    </NextIntlClientProvider>,
  );
}

function toggle(name: string) {
  return screen.getByRole<HTMLButtonElement>("switch", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  setBoardOption.mockResolvedValue(undefined);
});

describe("options du tableau", () => {
  it("défauts : « Sous-tâches » allumé, « Masquer les sous-tâches terminées » éteint et utilisable", () => {
    renderOptions(true, false);

    expect(toggle(SUBTASKS).getAttribute("aria-checked")).toBe("true");
    expect(toggle(HIDE_DONE).getAttribute("aria-checked")).toBe("false");
    expect(toggle(HIDE_DONE).disabled).toBe(false);
  });

  it("montre les deux valeurs reçues", () => {
    renderOptions(true, true);

    expect(toggle(SUBTASKS).getAttribute("aria-checked")).toBe("true");
    expect(toggle(HIDE_DONE).getAttribute("aria-checked")).toBe("true");
  });

  it("groupe nommé, pour les lecteurs d'écran", () => {
    renderOptions(true, false);

    expect(
      screen.getByRole("group", { name: "Options du tableau" }),
    ).toBeTruthy();
  });

  it("éteindre « Sous-tâches » enregistre subtasks = false et le montre tout de suite", () => {
    renderOptions(true, false);

    fireEvent.click(toggle(SUBTASKS));

    expect(toggle(SUBTASKS).getAttribute("aria-checked")).toBe("false");
    expect(setBoardOption).toHaveBeenCalledTimes(1);
    expect(setBoardOption).toHaveBeenCalledWith("subtasks", false);
  });

  it("allumer « Sous-tâches » enregistre subtasks = true", () => {
    renderOptions(false, false);

    fireEvent.click(toggle(SUBTASKS));

    expect(setBoardOption).toHaveBeenCalledWith("subtasks", true);
  });

  it("allumer « Masquer les sous-tâches terminées » enregistre hideDoneSubtasks = true", () => {
    renderOptions(true, false);

    fireEvent.click(toggle(HIDE_DONE));

    expect(toggle(HIDE_DONE).getAttribute("aria-checked")).toBe("true");
    expect(setBoardOption).toHaveBeenCalledTimes(1);
    expect(setBoardOption).toHaveBeenCalledWith("hideDoneSubtasks", true);
  });

  it("« Sous-tâches » éteint : le second interrupteur est désactivé, garde sa valeur et n'enregistre rien", () => {
    renderOptions(false, true);

    fireEvent.click(toggle(HIDE_DONE));

    expect(toggle(HIDE_DONE).disabled).toBe(true);
    expect(toggle(HIDE_DONE).getAttribute("aria-checked")).toBe("true");
    expect(setBoardOption).not.toHaveBeenCalled();
  });

  it("éteindre « Sous-tâches » désactive le second interrupteur sans attendre le serveur", async () => {
    let finish: () => void = () => {};
    setBoardOption.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderOptions(true, false);

    fireEvent.click(toggle(SUBTASKS));

    expect(toggle(HIDE_DONE).disabled).toBe(true);
    // Une action laissée en attente retiendrait les transitions des tests suivants (React les enchaîne).
    await act(async () => finish());
  });

  it("aria-busy sur l'interrupteur en cours d'enregistrement seulement, retiré ensuite", async () => {
    let finish: () => void = () => {};
    setBoardOption.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderOptions(true, false);

    fireEvent.click(toggle(HIDE_DONE));

    expect(toggle(HIDE_DONE).getAttribute("aria-busy")).toBe("true");
    expect(toggle(SUBTASKS).getAttribute("aria-busy")).toBe("false");
    await act(async () => finish());
    await waitFor(() =>
      expect(toggle(HIDE_DONE).getAttribute("aria-busy")).toBe("false"),
    );
  });

  it("échec de l'enregistrement : message visible et retour à la valeur enregistrée", async () => {
    setBoardOption.mockRejectedValue(new Error("réseau"));
    renderOptions(true, false);

    fireEvent.click(toggle(SUBTASKS));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        fr.shell.preferenceError,
      ),
    );
    await waitFor(() =>
      expect(toggle(SUBTASKS).getAttribute("aria-checked")).toBe("true"),
    );
    expect(toggle(HIDE_DONE).disabled).toBe(false);
  });

  it("session expirée : laisse Next naviguer vers /login, sans message d'échec", async () => {
    const control = expiredSessionRedirect();
    setBoardOption.mockRejectedValue(control);
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <CaughtBoundary onError={onError}>
        <NextIntlClientProvider locale="fr" messages={fr}>
          <BoardOptions subtasks hideDoneSubtasks={false} />
        </NextIntlClientProvider>
      </CaughtBoundary>,
    );
    const status = screen.getByRole("status");

    fireEvent.click(toggle(SUBTASKS));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(control));
    expect(status.textContent).toBe("");
    consoleError.mockRestore();
  });

  it("zones tactiles d'au moins 44 px", () => {
    renderOptions(true, false);

    for (const control of screen.getAllByRole("switch")) {
      expect(control.classList.contains("min-h-11")).toBe(true);
    }
  });

  it("en anglais : « Subtasks » et « Hide completed subtasks »", () => {
    renderOptions(true, true, "en");

    expect(screen.getByRole("group", { name: "Board options" })).toBeTruthy();
    expect(toggle("Subtasks").getAttribute("aria-checked")).toBe("true");
    expect(toggle("Hide completed subtasks").getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});

describe("cookie posé au clic (rechargement pendant l'enregistrement)", () => {
  it("garde le choix dans document.cookie tant que l'action serveur est en vol", () => {
    setBoardOption.mockReturnValue(new Promise(() => {}));
    renderOptions(true, false);

    fireEvent.click(toggle(SUBTASKS));

    expect(document.cookie).toContain("bmb_board_subtasks=0");
  });
});
