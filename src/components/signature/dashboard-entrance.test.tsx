import { render } from "@testing-library/react";
import gsap from "gsap";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BentoRevealSignature } from "./bento-reveal";
import { DashboardIntroSignature } from "./dashboard-intro";
import { EmptyStateSignature } from "./empty-state";
import {
  BENTO_REVEAL_SIGNATURE_KEY,
  DASHBOARD_INTRO_SIGNATURE_KEY,
  EMPTY_STATE_SIGNATURE_KEY,
  SIGNATURE_PENDING_ATTRIBUTE,
} from "./signature-keys";

// Les trois moments de l'entrée du tableau de bord (DESIGN.md § 7) partagent la même mécanique : joués
// une fois par session, coupés sous prefers-reduced-motion, cibles démasquées en démarrant.

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

/** Grille minimale : tuile pleine (intro), deux tuiles (reveal), deux éléments d'écran vide. */
function mountRoot() {
  const root = document.createElement("div");
  root.innerHTML = `
    <section data-signature="intro"><h2 data-signature-item>a</h2><p data-signature-item>b</p></section>
    <div data-signature="reveal"><p data-signature="empty">c</p></div>
    <div data-signature="reveal"><p data-signature="empty">d</p></div>`;
  document.body.append(root);
  const rootRef = createRef<HTMLDivElement>();
  rootRef.current = root;
  return { root, rootRef };
}

const MOMENTS = [
  {
    name: "entrée du tableau de bord",
    moment: "intro",
    key: DASHBOARD_INTRO_SIGNATURE_KEY,
    Component: DashboardIntroSignature,
    targets: (root: HTMLElement) => [
      root.querySelector('[data-signature="intro"]'),
    ],
  },
  {
    name: "révélation de la grille",
    moment: "reveal",
    key: BENTO_REVEAL_SIGNATURE_KEY,
    Component: BentoRevealSignature,
    targets: (root: HTMLElement) => [
      ...root.querySelectorAll('[data-signature="reveal"]'),
    ],
  },
  {
    name: "écrans vides",
    moment: "empty",
    key: EMPTY_STATE_SIGNATURE_KEY,
    Component: EmptyStateSignature,
    targets: (root: HTMLElement) => [
      ...root.querySelectorAll('[data-signature="empty"]'),
    ],
  },
] as const;

let from: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = "";
  document.documentElement.setAttribute(
    SIGNATURE_PENDING_ATTRIBUTE,
    "intro reveal empty",
  );
  stubReducedMotion(false);
  from = vi.spyOn(gsap, "from");
});

afterEach(() => {
  gsap.globalTimeline.clear();
  from.mockRestore();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(SIGNATURE_PENDING_ATTRIBUTE);
});

describe.each(MOMENTS)("moment signature : $name", (moment) => {
  it("joue à la première visite de la session et pose le marqueur", () => {
    const { root, rootRef } = mountRoot();

    render(<moment.Component rootRef={rootRef} />);

    expect(from).toHaveBeenCalledWith(
      moment.targets(root),
      expect.objectContaining({ autoAlpha: 0 }),
    );
    expect(sessionStorage.getItem(moment.key)).not.toBeNull();
  });

  it("démasque ses cibles en démarrant", () => {
    const { rootRef } = mountRoot();

    render(<moment.Component rootRef={rootRef} />);

    const pending =
      document.documentElement.getAttribute(SIGNATURE_PENDING_ATTRIBUTE) ?? "";
    expect(pending.split(" ")).not.toContain(moment.moment);
  });

  it("ne rejoue pas dans la même session", () => {
    sessionStorage.setItem(moment.key, "1");
    const { rootRef } = mountRoot();

    render(<moment.Component rootRef={rootRef} />);

    expect(from).not.toHaveBeenCalled();
  });

  it("ne joue rien et démasque tout de suite sous prefers-reduced-motion", () => {
    stubReducedMotion(true);
    const { rootRef } = mountRoot();

    render(<moment.Component rootRef={rootRef} />);

    expect(from).not.toHaveBeenCalled();
    const pending =
      document.documentElement.getAttribute(SIGNATURE_PENDING_ATTRIBUTE) ?? "";
    expect(pending.split(" ")).not.toContain(moment.moment);
  });

  it("stockage de session indisponible : ne joue rien et démasque", () => {
    const denied = () => {
      throw new DOMException("refusé", "SecurityError");
    };
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(denied);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(denied);
    const { rootRef } = mountRoot();

    render(<moment.Component rootRef={rootRef} />);

    getItem.mockRestore();
    setItem.mockRestore();
    expect(from).not.toHaveBeenCalled();
    const pending =
      document.documentElement.getAttribute(SIGNATURE_PENDING_ATTRIBUTE) ?? "";
    expect(pending.split(" ")).not.toContain(moment.moment);
  });

  it("un démontage pendant l'animation ne laisse aucune animation active", () => {
    const { root, rootRef } = mountRoot();
    const view = render(<moment.Component rootRef={rootRef} />);
    const [first] = moment.targets(root);
    expect(gsap.getTweensOf(first).length).toBeGreaterThan(0);

    view.unmount();

    expect(gsap.getTweensOf(first)).toHaveLength(0);
  });
});

describe("chorégraphie de l'entrée", () => {
  it("la révélation de la grille dure au plus 0,9 s, même avec beaucoup de tuiles", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-signature="reveal"></div>'.repeat(20);
    document.body.append(root);
    const rootRef = createRef<HTMLDivElement>();
    rootRef.current = root;

    render(<BentoRevealSignature rootRef={rootRef} />);

    const [, vars] = from.mock.calls[0] as [unknown, gsap.TweenVars];
    const tween = gsap.getTweensOf(root.firstElementChild)[0];
    expect(vars.delay).toBe(0.15);
    expect(tween?.totalDuration()).toBeLessThanOrEqual(0.9);
  });

  it("la salutation puis l'intro de la tuile pleine arrivent en décalé", () => {
    const { root, rootRef } = mountRoot();

    render(<DashboardIntroSignature rootRef={rootRef} />);

    expect(from).toHaveBeenCalledWith(
      [...root.querySelectorAll("[data-signature-item]")],
      expect.objectContaining({ stagger: 0.08 }),
    );
  });
});
