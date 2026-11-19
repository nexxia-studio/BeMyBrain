import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuickAddTrigger } from "@/components/quick-add/QuickAddTrigger";
import type { ShellScope } from "@/lib/current-scope";
import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../messages/fr.json";

const setSide = vi.hoisted(() => vi.fn());
const setContextSelection = vi.hoisted(() => vi.fn());
const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/preferences-actions", () => ({ setSide, setContextSelection }));
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));
// Moment signature de la bascule : hors sujet ici.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { ContextFilter } from "./ContextFilter";
import { ContextFilterMenu } from "./ContextFilterMenu";
import { ShellScopeProvider } from "./ShellScopeProvider";
import { SideSwitch } from "./SideSwitch";

const PRIVE = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  name: "Privé",
  color: "neutral",
} as const;
const TRUSTUP = {
  id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b",
  name: "Trustup",
  color: "warm",
} as const;
const NEXXIA = {
  id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
  name: "Nexxia",
  color: "indigo",
} as const;

function shell(
  side: "private" | "pro",
  proSelected: string[] = [TRUSTUP.id, NEXXIA.id],
): ShellScope {
  return {
    side,
    sides: {
      private: { contexts: [PRIVE], selected: [PRIVE.id] },
      pro: { contexts: [TRUSTUP, NEXXIA], selected: proSelected },
    },
  };
}

function renderShell(scope: ShellScope, controls: React.ReactNode) {
  render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <ShellScopeProvider shell={scope}>
        {controls}
        <QuickAddTrigger label="ajouter" className="">
          +
        </QuickAddTrigger>
      </ShellScopeProvider>
    </NextIntlClientProvider>,
  );
}

/** Ouvre l'ajout rapide, tape un titre et valide. */
function addTaskNow(title: string) {
  fireEvent.click(screen.getByRole("button", { name: "ajouter" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Tâche" }), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Enregistrement des préférences jamais terminé : le rendu serveur n'a pas encore suivi.
  setSide.mockReturnValue(new Promise(() => {}));
  setContextSelection.mockReturnValue(new Promise(() => {}));
  runAppAction.mockResolvedValue({ ok: true, result: { id: "x" } });
});

describe("portée de la coque (ajout rapide et palette)", () => {
  it("bascule Privé → Pro puis ajout immédiat : la tâche part du côté affiché, avec l'espace filtré de ce côté", async () => {
    renderShell(shell("private", [TRUSTUP.id]), <SideSwitch side="private" />);

    fireEvent.click(screen.getByRole("button", { name: "Pro" }));
    addTaskNow("Relancer le devis");

    await waitFor(() => expect(runAppAction).toHaveBeenCalled());
    expect(runAppAction).toHaveBeenCalledWith(
      "tasks.create",
      expect.objectContaining({ side: "pro", context: "Trustup" }),
    );
  });

  it("filtre sur un espace puis ajout immédiat : la tâche prend l'espace affiché", async () => {
    renderShell(
      shell("pro"),
      <ContextFilter
        side="pro"
        contexts={[TRUSTUP, NEXXIA]}
        selected={[TRUSTUP.id, NEXXIA.id]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Nexxia" }));
    addTaskNow("Maquette");

    await waitFor(() => expect(runAppAction).toHaveBeenCalled());
    expect(runAppAction).toHaveBeenCalledWith(
      "tasks.create",
      expect.objectContaining({ side: "pro", context: "Nexxia" }),
    );
  });

  it("filtre par la pastille mobile puis ajout immédiat : la tâche prend l'espace affiché", async () => {
    renderShell(
      shell("pro"),
      <ContextFilterMenu
        side="pro"
        contexts={[TRUSTUP, NEXXIA]}
        selected={[TRUSTUP.id, NEXXIA.id]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Espaces affichés/ }));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Trustup" }),
    );
    addTaskNow("Relancer");

    await waitFor(() => expect(runAppAction).toHaveBeenCalled());
    expect(runAppAction).toHaveBeenCalledWith(
      "tasks.create",
      expect.objectContaining({ side: "pro", context: "Trustup" }),
    );
  });

  it("sans geste en cours, prend le côté et l'espace du rendu serveur", async () => {
    renderShell(shell("pro", [NEXXIA.id]), null);

    addTaskNow("Maquette");

    await waitFor(() => expect(runAppAction).toHaveBeenCalled());
    expect(runAppAction).toHaveBeenCalledWith(
      "tasks.create",
      expect.objectContaining({ side: "pro", context: "Nexxia" }),
    );
  });
});
