import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("page d'accueil", () => {
  it("affiche la page d'accueil sans erreur", () => {
    render(<Home />);

    expect(screen.getByRole("main")).toBeDefined();
  });
});
