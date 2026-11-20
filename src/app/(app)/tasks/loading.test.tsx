import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

const pageHeaderProps = vi.hoisted(() => vi.fn());
const completedToggleProps = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "tasks.list") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son titre et ses actions.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string; actions?: React.ReactNode }) => {
    pageHeaderProps(props);
    return (
      <header>
        <h1>{props.title}</h1>
        {props.actions}
      </header>
    );
  },
}));
vi.mock("@/components/tasks/CompletedToggle", () => ({
  CompletedToggle: (props: { checked: boolean; href: string }) => {
    completedToggleProps(props);
    return <button type="button">{messages.tasks.list.completedToggle}</button>;
  },
}));

import TasksLoading from "./loading";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chargement de la liste des tâches", () => {
  it("pendant le chargement, le filtre d'espace est présent mais inerte et masqué (place réservée)", async () => {
    render(await TasksLoading());

    expect(pageHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ filterInert: true }),
    );
    expect(pageHeaderProps).not.toHaveBeenCalledWith(
      expect.objectContaining({ contextFilter: false }),
    );
  });

  it("titre par l'en-tête de page, statut, une tuile givrée à la largeur de la liste (max-w-3xl), aucun squelette", async () => {
    const { container } = render(await TasksLoading());

    expect(pageHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ title: messages.tasks.list.title }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: messages.tasks.list.title,
      }),
    ).toBeTruthy();
    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Chargement des tâches…",
    );

    const holder = screen.getByTestId("tasks-frost");
    expect(holder.textContent).toBe("");
    expect(holder.getAttribute("aria-hidden")).toBe("true");
    expect(holder.children).toHaveLength(1);
    const frost = holder.firstElementChild as HTMLElement;
    expect(frost.classList.contains("glass")).toBe(true);
    expect(frost.querySelectorAll(".frost")).toHaveLength(1);
    expect(frost.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["w-full", "max-w-3xl", "min-h-75"]),
    );
    expect(container.querySelector(".bg-track")).toBeNull();
  });

  it("réserve la place de l'interrupteur « Terminées » sans le montrer : l'en-tête ne bouge pas à l'arrivée", async () => {
    const { container } = render(await TasksLoading());

    expect(completedToggleProps).toHaveBeenCalledTimes(1);
    const toggle = screen.getByRole("button", { hidden: true });
    const holder = toggle.parentElement as HTMLElement;
    expect(holder.classList.contains("invisible")).toBe(true);
    expect(holder.getAttribute("aria-hidden")).toBe("true");
    expect(holder.hasAttribute("inert")).toBe(true);
    expect(container.querySelector("header")?.contains(holder)).toBe(true);
  });
});
