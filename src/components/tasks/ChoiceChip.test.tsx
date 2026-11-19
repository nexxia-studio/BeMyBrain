import { render, screen } from "@testing-library/react";
import { Flag } from "lucide-react";
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
});
