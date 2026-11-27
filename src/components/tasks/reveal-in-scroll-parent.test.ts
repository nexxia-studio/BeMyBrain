import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revealInScrollParent } from "./reveal-in-scroll-parent";

type Box = { top: number; bottom: number };

function rect({ top, bottom }: Box): DOMRect {
  return { top, bottom, height: bottom - top } as DOMRect;
}

/** Parent défilant (`overflow-y: auto`) de 0 à 500 px, élément posé à `box`, `scrollTop` observable. */
function setup(box: Box, overflowY = "auto") {
  const outer = document.createElement("div");
  outer.style.overflowY = overflowY;
  outer.getBoundingClientRect = () => rect({ top: 0, bottom: 500 });
  let scrollTop = 100;
  Object.defineProperty(outer, "scrollTop", {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  const middle = document.createElement("div");
  middle.style.overflowY = "hidden";
  const element = document.createElement("div");
  element.getBoundingClientRect = () => rect(box);
  middle.append(element);
  outer.append(middle);
  document.body.append(outer);
  return { element, scrollTop: () => scrollTop };
}

// jsdom ne définit pas `scrollIntoView` : espion posé à la main, retiré après chaque test.
const scrollIntoView = vi.fn();
const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  document.body.replaceChildren();
  scrollIntoView.mockClear();
  scrollTo.mockClear();
});

describe("mise dans le champ de vision du seul conteneur défilant", () => {
  it("fait défiler vers le bas de l'écart, marge comprise, quand l'élément dépasse du bas", () => {
    const { element, scrollTop } = setup({ top: 300, bottom: 620 });

    revealInScrollParent(element, 8);

    expect(scrollTop()).toBe(100 + 120 + 8);
  });

  it("ne bouge pas quand l'élément est déjà entièrement visible", () => {
    const { element, scrollTop } = setup({ top: 100, bottom: 400 });

    revealInScrollParent(element);

    expect(scrollTop()).toBe(100);
  });

  it("remonte quand l'élément est au-dessus du haut du conteneur", () => {
    const { element, scrollTop } = setup({ top: -40, bottom: 100 });

    revealInScrollParent(element, 8);

    expect(scrollTop()).toBe(100 - 40 - 8);
  });

  it("un élément plus haut que le conteneur garde son haut visible", () => {
    const { element, scrollTop } = setup({ top: 200, bottom: 900 });

    revealInScrollParent(element, 8);

    expect(scrollTop()).toBe(100 + 200 - 8);
  });

  it("ne touche ni à la page ni à scrollIntoView, et ne fait rien sans conteneur défilant", () => {
    const { element } = setup({ top: 300, bottom: 620 });
    revealInScrollParent(element);
    const alone = document.createElement("div");
    document.body.append(alone);

    expect(() => revealInScrollParent(alone)).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
