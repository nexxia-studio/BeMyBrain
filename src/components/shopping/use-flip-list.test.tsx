import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlipList } from "./use-flip-list";

function List({ ids, hidden = false }: { ids: string[]; hidden?: boolean }) {
  const ref = useRef<HTMLUListElement>(null);
  useFlipList(ref);
  return (
    <ul ref={ref} hidden={hidden}>
      {ids.map((id) => (
        <li key={id} data-flip-id={id}>
          {id}
        </li>
      ))}
    </ul>
  );
}

const animate = vi.fn();
const cancel = vi.fn();
let reduced = false;

beforeEach(() => {
  animate.mockReset().mockImplementation(() => ({ cancel }));
  cancel.mockReset();
  reduced = false;
  // jsdom ne calcule aucune géométrie : chaque ligne fait 40 px, rangée selon sa place dans la liste.
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.flipId
        ? Array.from(this.parentElement!.children).indexOf(this) * 40
        : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("reduced-motion"),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "offsetTop");
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
});

describe("useFlipList", () => {
  it("n'anime rien au premier rendu", () => {
    render(<List ids={["a", "b"]} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("anime chaque ligne déplacée depuis sa position précédente quand l'ordre change", () => {
    const { rerender } = render(<List ids={["a", "b"]} />);
    rerender(<List ids={["b", "a"]} />);
    expect(animate).toHaveBeenCalledTimes(2);
    const calls = animate.mock.calls.map(([frames, options]) => ({
      frames,
      options,
    }));
    // b passe de 40 à 0 px : part de +40 ; a passe de 0 à 40 px : part de -40.
    expect(calls.map((c) => c.frames[0].transform).sort()).toEqual([
      "translateY(-40px)",
      "translateY(40px)",
    ]);
    expect(calls[0].options.duration).toBe(250);
  });

  it("n'anime pas en mouvement réduit", () => {
    reduced = true;
    const { rerender } = render(<List ids={["a", "b"]} />);
    rerender(<List ids={["b", "a"]} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("n'anime rien quand la liste est dépliée après avoir été masquée", () => {
    const { rerender } = render(<List ids={["a", "b"]} hidden />);
    rerender(<List ids={["a", "b"]} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("annule l'animation en cours quand l'ordre change de nouveau", () => {
    const { rerender } = render(<List ids={["a", "b"]} />);
    rerender(<List ids={["b", "a"]} />);
    animate.mockClear();
    rerender(<List ids={["a", "b"]} />);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenCalledTimes(2);
  });
});
