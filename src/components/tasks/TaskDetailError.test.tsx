import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const reportClientError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-client", () => ({ reportClientError }));
const push = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ current: "" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search.current),
}));

import { TaskDetailError } from "./TaskDetailError";

function renderError(
  error: Error & { digest?: string } = new Error("panne"),
  { locale = "fr", retry = vi.fn() } = {},
) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <TaskDetailError error={error} retry={retry} />
    </NextIntlClientProvider>,
  );
  return retry;
}

beforeEach(() => {
  vi.clearAllMocks();
  search.current = "";
});

describe("erreur de lecture du détail d'une tâche", () => {
  it("message propre au détail, dans la fenêtre du détail (pas celui de la liste)", () => {
    renderError();

    const dialog = screen.getByRole("dialog", { name: "Détail de la tâche" });
    expect(dialog.textContent).toContain(fr.tasks.detail.error.title);
    expect(dialog.textContent).toContain(fr.tasks.detail.error.body);
    expect(document.body.textContent).not.toContain(fr.tasks.list.error.title);
  });

  it("en anglais : textes de la langue choisie", () => {
    renderError(new Error("panne"), { locale: "en" });

    const dialog = screen.getByRole("dialog", { name: en.tasks.detail.label });
    expect(dialog.textContent).toContain(en.tasks.detail.error.title);
    expect(
      screen.getByRole("button", { name: en.tasks.detail.error.retry }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: en.tasks.detail.close }),
    ).toBeTruthy();
  });

  it("texte fixe : jamais le message ni le digest de l'erreur", () => {
    renderError(
      Object.assign(new Error("panne Relancer le devis"), { digest: "987" }),
    );

    expect(document.body.textContent).not.toContain("Relancer le devis");
    expect(document.body.textContent).not.toContain("987");
  });

  it("ni <main> ni <h1> : la page garde ceux de la liste", () => {
    renderError();

    expect(document.querySelector("main")).toBeNull();
    expect(document.querySelector("h1")).toBeNull();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: fr.tasks.detail.error.title,
      }),
    ).toBeTruthy();
  });

  it("« Réessayer » refait les requêtes (retry)", () => {
    const retry = renderError();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it("l'erreur part une fois chez Sentry", () => {
    const error = new Error("panne");
    renderError(error);

    expect(reportClientError).toHaveBeenCalledOnce();
    expect(reportClientError).toHaveBeenCalledWith(error);
  });

  it("« Fermer » ferme le détail et ramène à la liste", async () => {
    renderError();

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/tasks", { scroll: false }),
    );
    expect(push).toHaveBeenCalledOnce();
  });

  it("« Fermer » garde les terminées affichées (?completed=1)", async () => {
    search.current = "completed=1";
    renderError();

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/tasks?completed=1", {
        scroll: false,
      }),
    );
  });
});
