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

type SideValue = "private" | "pro";

/** Monte le moment signature ; `side` peut déjà différer du côté initial (bascule avant chargement). */
function setup(
  side: SideValue = "private",
  initialSide: SideValue = "private",
) {
  const thumbRef = createRef<HTMLSpanElement>();
  const thumb = document.createElement("span");
  document.body.append(thumb);
  thumbRef.current = thumb;
  const element = (current: SideValue) => (
    <SideSwitchSignature
      thumbRef={thumbRef}
      initialSide={initialSide}
      side={current}
    />
  );
  const view = render(element(side));
  const switchTo = (next: SideValue) => view.rerender(element(next));
  return { switchTo, thumb, unmount: view.unmount };
}

let from: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  stubReducedMotion(false);
  from = vi.spyOn(gsap, "from");
});

afterEach(() => {
  gsap.globalTimeline.clear();
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

  it("une bascule faite avant le chargement de GSAP pose le marqueur et joue la glissade", () => {
    setup("pro", "private");

    expect(from).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SIDE_SWITCH_SIGNATURE_KEY)).not.toBeNull();
  });

  it("un démontage pendant la glissade ne laisse aucune animation active", () => {
    const { switchTo, thumb, unmount } = setup();
    switchTo("pro");
    expect(gsap.getTweensOf(thumb)).toHaveLength(1);

    unmount();

    expect(gsap.getTweensOf(thumb)).toHaveLength(0);
  });
});
