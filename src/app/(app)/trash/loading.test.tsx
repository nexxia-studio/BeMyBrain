import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

const pageHeaderProps = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "trash") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son seul titre.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string; contextFilter?: boolean }) => {
    pageHeaderProps(props);
    return <h1>{props.title}</h1>;
  },
}));

import TrashLoading from "./loading";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chargement de la corbeille", () => {
  it("titre par l'en-tête de page (sans filtre d'espace), statut, une tuile givrée pleine largeur, aucun squelette", async () => {
    const { container } = render(await TrashLoading());

    expect(pageHeaderProps).toHaveBeenCalledWith({
      title: messages.trash.title,
      contextFilter: false,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: messages.trash.title }),
    ).toBeTruthy();
    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Chargement de la corbeille…",
    );

    const holder = screen.getByTestId("trash-frost");
    expect(holder.textContent).toBe("");
    expect(holder.getAttribute("aria-hidden")).toBe("true");
    expect(holder.children).toHaveLength(1);
    const frost = holder.firstElementChild as HTMLElement;
    expect(frost.classList.contains("glass")).toBe(true);
    expect(frost.querySelectorAll(".frost")).toHaveLength(1);
    expect(frost.classList.contains("min-h-75")).toBe(true);
    expect(frost.className).not.toMatch(/max-w-/);
    expect(screen.queryByTestId("trash-skeleton")).toBeNull();
    expect(container.querySelector(".bg-track")).toBeNull();
  });
});
