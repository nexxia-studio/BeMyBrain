import { render } from "@testing-library/react";
import gsap from "gsap";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIDE_SWITCH_SIGNATURE_KEY, SideSwitchSignature } from "./side-switch";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce
      ? query.includes(": reduce")
      : query.includes("no-preference"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

function setup() {
  const thumbRef = createRef<HTMLSpanElement>();
  const thumb = document.createElement("span");
  document.body.append(thumb);
  thumbRef.current = thumb;
  const view = render(
    <SideSwitchSignature thumbRef={thumbRef} side="private" />,
  );
  const switchTo = (side: "private" | "pro") =>
    view.rerender(<SideSwitchSignature thumbRef={thumbRef} side={side} />);
  return { switchTo };
}

let from: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  stubReducedMotion(false);
  from = vi.spyOn(gsap, "from");
});

afterEach(() => {
  from.mockRestore();
  vi.unstubAllGlobals();
});

describe("moment signature de la bascule Privé / Pro", () => {
  it("ne joue rien au premier affichage", () => {
    setup();

    expect(from).not.toHaveBeenCalled();
  });

  it("fait glisser la pilule active à la première bascule de la session", () => {
    const { switchTo } = setup();

    switchTo("pro");

    expect(from).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SIDE_SWITCH_SIGNATURE_KEY)).not.toBeNull();
  });

  it("la deuxième bascule ne déclenche aucune animation", () => {
    const { switchTo } = setup();
    switchTo("pro");

    switchTo("private");

    expect(from).toHaveBeenCalledTimes(1);
  });

  it("ne rejoue pas dans la même session après un rechargement", () => {
    sessionStorage.setItem(SIDE_SWITCH_SIGNATURE_KEY, "1");
    const { switchTo } = setup();

    switchTo("pro");

    expect(from).not.toHaveBeenCalled();
  });

  it("ne joue rien quand le système demande moins de mouvement", () => {
    stubReducedMotion(true);
    const { switchTo } = setup();

    switchTo("pro");

    expect(from).not.toHaveBeenCalled();
  });
});
