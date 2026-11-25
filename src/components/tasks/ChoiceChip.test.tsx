import { fireEvent, render, screen } from "@testing-library/react";
import { CircleDot, Flag, SignalHigh } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

// Props reçues par le positionneur du menu (le placement réel n'existe pas en jsdom : on vérifie la
// consigne passée à Base UI ; le résultat à 390 px est vérifié par l'e2e de l'ajout rapide mobile).
const positionerProps = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@base-ui/react/menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@base-ui/react/menu")>();
  const { createElement } = await import("react");
  const Original = actual.Menu.Positioner;
  function Positioner(props: Record<string, unknown>) {
    positionerProps.push(props);
    return createElement(Original, props);
  }
  return { ...actual, Menu: { ...actual.Menu, Positioner } };
});

import { chipPositionerProps } from "./chip-styles";
import { ChoiceChip } from "./ChoiceChip";

describe("pastille à choix unique", () => {
  it("garde la taille de texte des pastilles et l'encre de la valeur choisie", () => {
    render(
      <ChoiceChip
        label="Priorité : Normale"
        icon={Flag}
        options={[{ value: "normal", label: "Normale" }]}
        value="normal"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    const classes = screen
      .getByRole("button", { name: "Priorité : Normale" })
      .className.split(/\s+/);

    expect(classes).toEqual(
      expect.arrayContaining(["text-small", "text-foreground"]),
    );
  });

  it("dans un menu à icônes, un choix sans icône garde la place de l'icône (libellés alignés)", async () => {
    render(
      <ChoiceChip
        label="Priorité : Aucune"
        icon={Flag}
        options={[
          { value: "0", label: "Aucune" },
          { value: "2", label: "Haute", icon: SignalHigh },
        ]}
        value="0"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Priorité : Aucune" }));
    const item = await screen.findByRole("menuitemradio", { name: "Aucune" });

    expect(item.querySelector("svg:not(.lucide-check)")).toBeNull();
    expect(item.querySelector("[data-icon-slot]")).not.toBeNull();
  });

  it("dans le menu, l'icône d'un choix prend sa propre couleur à la place de l'encre (En cours : indigo)", async () => {
    render(
      <ChoiceChip
        label="Statut : À faire"
        icon={Flag}
        options={[
          { value: "unstarted", label: "À faire", icon: Flag },
          {
            value: "started",
            label: "En cours",
            icon: CircleDot,
            iconClass: "text-link",
          },
        ]}
        value="unstarted"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Statut : À faire" }));
    const started = await screen.findByRole("menuitemradio", {
      name: "En cours",
    });
    const plain = screen.getByRole("menuitemradio", { name: "À faire" });
    const tone = (item: HTMLElement) =>
      item.querySelector("svg:not(.lucide-check)")!.classList;

    expect(tone(started).contains("text-link")).toBe(true);
    expect(tone(started).contains("text-foreground")).toBe(false);
    // Sans couleur propre : l'encre par défaut.
    expect(tone(plain).contains("text-foreground")).toBe(true);
  });

  it("un choix teinté : la pastille prend son fond et son encre quand il est choisi, icône à la même encre", () => {
    render(
      <ChoiceChip
        label="Priorité : Haute"
        icon={Flag}
        options={[
          { value: "0", label: "Aucune" },
          {
            value: "2",
            label: "Haute",
            icon: SignalHigh,
            chipClass: "bg-priority-high text-priority-high-foreground",
          },
        ]}
        value="2"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Priorité : Haute" });
    const classes = trigger.className.split(/\s+/);

    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-priority-high",
        "text-priority-high-foreground",
        "text-small",
        "rounded-full",
        "min-h-11",
      ]),
    );
    // Le fond et l'encre ordinaires cèdent la place : une seule couleur de fond, une seule de texte.
    expect(classes).not.toContain("bg-secondary");
    expect(classes).not.toContain("text-foreground");
    const icon = trigger.querySelector("svg.lucide-signal-high")!;
    expect(icon.getAttribute("class")).not.toMatch(/\btext-/);
  });

  it("un choix sans teinte laisse la pastille ordinaire, même si d'autres choix sont teintés", () => {
    render(
      <ChoiceChip
        label="Priorité : Aucune"
        icon={Flag}
        options={[
          { value: "0", label: "Aucune" },
          {
            value: "2",
            label: "Haute",
            icon: SignalHigh,
            chipClass: "bg-priority-high text-priority-high-foreground",
          },
        ]}
        value="0"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Priorité : Aucune" });
    const classes = trigger.className.split(/\s+/);

    expect(classes).toEqual(
      expect.arrayContaining(["bg-secondary", "text-foreground"]),
    );
    expect(trigger.className).not.toContain("priority");
    expect(trigger.querySelector("svg.lucide-flag")).not.toBeNull();
  });

  it("dans le menu, un choix à badge pose son icône dans le badge, à l'encre du badge ; un choix sans badge garde une place de la même largeur", async () => {
    render(
      <ChoiceChip
        label="Priorité : Aucune"
        icon={Flag}
        options={[
          { value: "0", label: "Aucune" },
          {
            value: "2",
            label: "Haute",
            icon: SignalHigh,
            iconBadgeClass: "flex size-5 bg-priority-high",
          },
        ]}
        value="0"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Priorité : Aucune" }));
    const high = await screen.findByRole("menuitemradio", { name: "Haute" });
    const none = screen.getByRole("menuitemradio", { name: "Aucune" });

    const icon = high.querySelector("svg.lucide-signal-high")!;
    const badge = icon.parentElement!;
    expect(badge.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "size-5", "bg-priority-high"]),
    );
    expect(badge.getAttribute("aria-hidden")).toBe("true");
    expect(icon.classList.contains("text-foreground")).toBe(false);
    expect(none.querySelector("[class*='bg-priority-']")).toBeNull();
    expect(
      none.querySelector("[data-icon-slot]")!.classList.contains("size-5"),
    ).toBe(true);
  });

  it("sans badge (Statut), l'icône du menu reste nue et la place vide fait 16 px", async () => {
    render(
      <ChoiceChip
        label="Statut : À faire"
        icon={Flag}
        options={[
          { value: "unstarted", label: "À faire" },
          { value: "started", label: "En cours", icon: CircleDot },
        ]}
        value="unstarted"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Statut : À faire" }));
    const started = await screen.findByRole("menuitemradio", {
      name: "En cours",
    });
    const plain = screen.getByRole("menuitemradio", { name: "À faire" });

    const icon = started.querySelector("svg.lucide-circle-dot")!;
    expect(icon.parentElement).toBe(started);
    expect(
      plain.querySelector("[data-icon-slot]")!.classList.contains("size-4"),
    ).toBe(true);
  });

  it("menu placé comme les autres pastilles : 16 px des bords latéraux et du haut", async () => {
    render(
      <ChoiceChip
        label="Statut : À faire"
        icon={Flag}
        options={[{ value: "unstarted", label: "À faire" }]}
        value="unstarted"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Statut : À faire" }));
    await screen.findByRole("menuitemradio", { name: "À faire" });

    expect(positionerProps.at(-1)).toMatchObject(chipPositionerProps);
  });
});
