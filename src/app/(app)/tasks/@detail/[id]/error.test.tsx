import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../../../messages/fr.json";

const reportClientError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-client", () => ({ reportClientError }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import DetailError from "./error";

describe("erreur de lecture du détail (ouvert par son adresse)", () => {
  it("message du détail dans sa fenêtre, « Réessayer » relié à retry", () => {
    const retry = vi.fn();
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <DetailError error={new Error("panne")} retry={retry} />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    const dialog = screen.getByRole("dialog", { name: "Détail de la tâche" });
    expect(dialog.textContent).toContain("Détail indisponible");
    expect(document.querySelector("main")).toBeNull();
    expect(retry).toHaveBeenCalledOnce();
  });
});
