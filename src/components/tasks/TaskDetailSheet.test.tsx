import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../messages/fr.json";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

import { TaskDetailSheet } from "./TaskDetailSheet";

function renderSheet(close: { closeHref: string } | { onClose: () => void }) {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <TaskDetailSheet {...close}>
        {(closeButton) => <div>{closeButton}</div>}
      </TaskDetailSheet>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("fenêtre du détail : fermeture", () => {
  it("sans rappel : retour à la liste après l'animation de sortie", async () => {
    renderSheet({ closeHref: "/tasks?completed=1" });

    fireEvent.click(
      screen.getByRole("button", { name: fr.tasks.detail.close }),
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/tasks?completed=1", {
        scroll: false,
      }),
    );
  });

  it("avec un rappel : le rappel après l'animation de sortie, aucune navigation", async () => {
    const onClose = vi.fn();
    renderSheet({ onClose });

    fireEvent.click(
      screen.getByRole("button", { name: fr.tasks.detail.close }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
