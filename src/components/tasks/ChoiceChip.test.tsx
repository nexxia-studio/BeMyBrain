import { fireEvent, render, screen } from "@testing-library/react";
import { Flag, SignalHigh } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

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
});
