import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FrostTile } from "./FrostTile";

function veilOf(tile: HTMLElement): Element | null {
  return tile.querySelector(".frost");
}

describe("FrostTile", () => {
  it("rend une tuile de verre aria-hidden avec un voile enfant", () => {
    const { container } = render(<FrostTile />);
    const tile = container.firstElementChild as HTMLElement;

    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect([...tile.classList]).toEqual(
      expect.arrayContaining([
        "glass",
        "rounded-tile",
        "relative",
        "isolate",
        "overflow-hidden",
      ]),
    );
    const veil = veilOf(tile);
    expect(veil).not.toBeNull();
    expect(veil?.parentElement).toBe(tile);
    expect([...(veil?.classList ?? [])]).toEqual(
      expect.arrayContaining([
        "pointer-events-none",
        "absolute",
        "inset-0",
        "-z-1",
      ]),
    );
  });

  it("pose --frost-index", () => {
    const { container } = render(<FrostTile index={3} />);
    const tile = container.firstElementChild as HTMLElement;

    expect(tile.style.getPropertyValue("--frost-index")).toBe("3");
  });

  it("fusionne la classe de taille", () => {
    const { container } = render(
      <FrostTile className="grow-2 basis-100 lg:min-h-75" />,
    );
    const tile = container.firstElementChild as HTMLElement;

    expect([...tile.classList]).toEqual(
      expect.arrayContaining(["glass", "grow-2", "basis-100", "lg:min-h-75"]),
    );
  });

  it("la variante pleine n'a pas de voile", () => {
    const { container } = render(
      <FrostTile variant="solid" className="basis-100" />,
    );
    const tile = container.firstElementChild as HTMLElement;

    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect([...tile.classList]).toEqual(
      expect.arrayContaining([
        "bg-primary",
        "shadow-today",
        "rounded-tile",
        "basis-100",
      ]),
    );
    expect(tile.classList.contains("glass")).toBe(false);
    expect(veilOf(tile)).toBeNull();
  });

  it("la variante ligne : surface de ligne donnée par la classe, voile, sans verre ni rayon de tuile", () => {
    const { container } = render(
      <FrostTile variant="row" index={2} className="rounded-lg bg-row" />,
    );
    const tile = container.firstElementChild as HTMLElement;

    expect([...tile.classList]).toEqual(
      expect.arrayContaining(["rounded-lg", "bg-row", "relative", "isolate"]),
    );
    expect(tile.classList.contains("glass")).toBe(false);
    expect(tile.classList.contains("rounded-tile")).toBe(false);
    expect(veilOf(tile)).not.toBeNull();
    expect(tile.style.getPropertyValue("--frost-index")).toBe("2");
  });

  it("rend ses enfants après le voile et pose son data-testid", () => {
    const { container } = render(
      <FrostTile testId="frost-row">
        <span data-testid="cale" />
      </FrostTile>,
    );
    const tile = container.firstElementChild as HTMLElement;

    expect(tile.dataset.testid).toBe("frost-row");
    expect(tile.firstElementChild?.classList.contains("frost")).toBe(true);
    expect(tile.lastElementChild?.getAttribute("data-testid")).toBe("cale");
  });
});
