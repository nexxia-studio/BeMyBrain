import { render } from "@testing-library/react";
import gsap from "gsap";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SideSwitchTilesSignature } from "./side-switch-tiles";
import { SIDE_SWITCH_TILES_SIGNATURE_KEY } from "./signature-keys";

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

function setup(side: SideValue = "private", initialSide: SideValue = "private") {
  const root = document.createElement("div");
  root.innerHTML = '<div data-signature="reveal"></div><div data-signature="reveal"></div>';
  document.body.append(root);
  const rootRef = createRef<HTMLDivElement>();
  rootRef.current = root;
  const element = (current: SideValue) => (
    <SideSwitchTilesSignature
      rootRef={rootRef}
      initialSide={initialSide}
      side={current}
    />
  );
  const view = render(element(side));
  return {
    root,
    switchTo: (next: SideValue) => view.rerender(element(next)),
    unmount: view.unmount,
  };
}

let from: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = "";
  stubReducedMotion(false);
  from = vi.spyOn(gsap, "from");
});

afterEach(() => {
  gsap.globalTimeline.clear();
  from.mockRestore();
  vi.unstubAllGlobals();
});

describe("fondu des tuiles à la bascule Privé / Pro", () => {
  it("ne joue rien au premier affichage", () => {
    setup();

    expect(from).not.toHaveBeenCalled();
  });

  it("fait apparaître les tuiles du nouveau côté à la première bascule de la session", () => {
    const { root, switchTo } = setup();

    switchTo("pro");

    expect(from).toHaveBeenCalledWith(
      [...root.querySelectorAll('[data-signature="reveal"]')],
      expect.objectContaining({ autoAlpha: 0, y: 8, duration: 0.25 }),
    );
    expect(sessionStorage.getItem(SIDE_SWITCH_TILES_SIGNATURE_KEY)).not.toBeNull();
  });

  it("la deuxième bascule est instantanée", () => {
    const { switchTo } = setup();
    switchTo("pro");

    switchTo("private");

    expect(from).toHaveBeenCalledTimes(1);
  });

  it("ne joue pas si la moitié « tuiles » a déjà été consommée dans la session", () => {
    sessionStorage.setItem(SIDE_SWITCH_TILES_SIGNATURE_KEY, "1");
    const { switchTo } = setup();

    switchTo("pro");

    expect(from).not.toHaveBeenCalled();
  });

  it("ne joue rien sous prefers-reduced-motion, mais consomme le moment", () => {
    stubReducedMotion(true);
    const { switchTo } = setup();

    switchTo("pro");

    expect(from).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(SIDE_SWITCH_TILES_SIGNATURE_KEY)).not.toBeNull();
  });

  it("une bascule arrivée avant le chargement de GSAP joue le fondu", () => {
    setup("pro", "private");

    expect(from).toHaveBeenCalledTimes(1);
  });

  it("un démontage pendant le fondu ne laisse aucune animation active", () => {
    const { root, switchTo, unmount } = setup();
    switchTo("pro");
    const tile = root.firstElementChild;
    expect(gsap.getTweensOf(tile).length).toBeGreaterThan(0);

    unmount();

    expect(gsap.getTweensOf(tile)).toHaveLength(0);
  });
});
