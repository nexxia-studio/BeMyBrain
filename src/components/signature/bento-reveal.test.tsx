import { render } from "@testing-library/react";
import gsap from "gsap";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BentoRevealSignature } from "./bento-reveal";
import { DashboardIntroSignature } from "./dashboard-intro";
import {
  BENTO_REVEAL_SIGNATURE_KEY,
  DASHBOARD_INTRO_SIGNATURE_KEY,
} from "./signature-keys";

// Reflet à la fin de la révélation (DESIGN.md § 7, ligne « Reflet ») : un calque par tuile de verre balaie
// de gauche à droite, 0,1 s après la fin du mouvement de la dernière tuile, une fois par session.

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

/**
 * Grille : tuile pleine (avec un calque leurre, qui ne doit jamais bouger), trois tuiles de verre avec
 * leur calque de reflet.
 */
function mountRoot() {
  const root = document.createElement("div");
  const glassTile =
    '<div data-signature="reveal"><section class="glass"><div data-sheen aria-hidden="true"></div><p>t</p></section></div>';
  root.innerHTML = `
    <section data-signature="intro"><div data-sheen></div><h2 data-signature-item>a</h2><p data-signature-item>b</p></section>
    ${glassTile.repeat(3)}`;
  document.body.append(root);
  const rootRef = createRef<HTMLDivElement>();
  rootRef.current = root;
  const tiles = [
    ...root.querySelectorAll<HTMLElement>('[data-signature="reveal"]'),
  ];
  const sheens = tiles.map(
    (tile) => tile.querySelector("[data-sheen]") as HTMLElement,
  );
  const intro = root.querySelector<HTMLElement>('[data-signature="intro"]');
  const decoy = intro?.querySelector<HTMLElement>("[data-sheen]");
  if (!intro || !decoy) throw new Error("grille de test incomplète");
  return { root, rootRef, tiles, sheens, intro, decoy };
}

/** Tween du balayage d'un calque et son départ dans le temps global. */
function sheenTween(sheen: HTMLElement) {
  const [tween] = gsap.getTweensOf(sheen);
  if (!tween?.parent) throw new Error("aucun balayage sur ce calque");
  const timeline = tween.parent;
  return {
    tween,
    timeline,
    globalStart: timeline.startTime() + tween.startTime(),
  };
}

/** Fin globale du dernier tween d'un ensemble d'éléments. */
function lastEnd(targets: Element[]): number {
  return Math.max(...gsap.getTweensOf(targets).map((tween) => tween.endTime()));
}

const TRANSFORM_PROPS = new Set(["x", "xPercent"]);
const TWEEN_CONFIG = new Set([
  "duration",
  "ease",
  "stagger",
  "force3D",
  "clearProps",
  "startAt",
  "immediateRender",
  "overwrite",
  "delay",
  "data",
  "runBackwards",
  "parent",
]);

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = "";
  stubReducedMotion(false);
});

afterEach(() => {
  gsap.globalTimeline.clear();
  vi.unstubAllGlobals();
});

describe("reflet à la fin de la révélation", () => {
  it("le balayage démarre après la fin du mouvement de la dernière tuile (position dans la timeline)", () => {
    // Entrée déjà jouée : seule la révélation compte.
    sessionStorage.setItem(DASHBOARD_INTRO_SIGNATURE_KEY, "1");
    const { rootRef, tiles, sheens } = mountRoot();

    render(<BentoRevealSignature rootRef={rootRef} />);

    const tilesEnd = lastEnd(tiles);
    const first = sheenTween(sheens[0] as HTMLElement);
    expect(first.globalStart).toBeCloseTo(tilesEnd + 0.1, 5);
    // Un passage de 2,2 s par calque, décalés de 0,16 s dans l'ordre de lecture.
    expect(first.tween.vars.duration).toBe(2.2);
    expect(first.tween.vars.stagger).toBe(0.16);
    expect(first.tween.vars.ease).toBe("sine.inOut");
    expect(first.tween.targets()).toEqual(sheens);
  });

  it("attend aussi la fin de l'entrée quand elle joue", () => {
    const { rootRef, tiles, sheens, intro } = mountRoot();

    render(
      <>
        <DashboardIntroSignature rootRef={rootRef} />
        <BentoRevealSignature rootRef={rootRef} />
      </>,
    );

    const introEnd = lastEnd([
      intro,
      ...intro.querySelectorAll("[data-signature-item]"),
    ]);
    const settled = Math.max(introEnd, lastEnd(tiles));
    expect(sheenTween(sheens[0] as HTMLElement).globalStart).toBeCloseTo(
      settled + 0.1,
      5,
    );
  });

  it("attend l'entrée en attente même si elle n'a pas encore démarré", () => {
    const { rootRef, sheens } = mountRoot();

    // Entrée pas encore chargée : sa fin vient de ses constantes (tuile 0,6 s ; 2 éléments décalés de 0,08 s).
    const before = gsap.globalTimeline.time();
    render(<BentoRevealSignature rootRef={rootRef} />);

    expect(
      sheenTween(sheens[0] as HTMLElement).globalStart - before,
    ).toBeCloseTo(0.08 + 0.08 + 0.6 + 0.1, 5);
  });

  it("seuls les calques des tuiles de verre sont animés, jamais la tuile pleine", () => {
    const { rootRef, sheens, decoy } = mountRoot();

    render(<BentoRevealSignature rootRef={rootRef} />);

    for (const sheen of sheens) {
      expect(gsap.getTweensOf(sheen)).toHaveLength(1);
    }
    expect(gsap.getTweensOf(decoy)).toHaveLength(0);
  });

  it("n'anime que transform", () => {
    const { rootRef, sheens } = mountRoot();

    render(<BentoRevealSignature rootRef={rootRef} />);

    const { tween } = sheenTween(sheens[0] as HTMLElement);
    const vars = tween.vars as Record<string, unknown>;
    const animated = Object.keys(vars).filter((key) => !TWEEN_CONFIG.has(key));
    const start = Object.keys((vars.startAt ?? {}) as object).filter(
      (key) => !TWEEN_CONFIG.has(key),
    );
    expect(animated).toContain("xPercent");
    expect([...animated, ...start].every((k) => TRANSFORM_PROPS.has(k))).toBe(
      true,
    );
    expect(vars.startAt).toMatchObject({ xPercent: -110 });
    expect(vars.xPercent).toBe(110);
    expect(vars.force3D).toBe(true);
  });

  it("session déjà jouée : ni révélation ni reflet", () => {
    sessionStorage.setItem(BENTO_REVEAL_SIGNATURE_KEY, "1");
    const { rootRef, tiles, sheens } = mountRoot();

    render(<BentoRevealSignature rootRef={rootRef} />);

    expect(gsap.getTweensOf([...tiles, ...sheens])).toHaveLength(0);
  });

  it("mouvement réduit : aucun tween", () => {
    stubReducedMotion(true);
    const { rootRef, tiles, sheens } = mountRoot();

    render(<BentoRevealSignature rootRef={rootRef} />);

    expect(gsap.getTweensOf([...tiles, ...sheens])).toHaveLength(0);
    for (const sheen of sheens) expect(sheen.getAttribute("style")).toBeNull();
  });

  it("à la fin du balayage : calques revenus hors champ, aucun style laissé", () => {
    const { rootRef, sheens } = mountRoot();
    render(<BentoRevealSignature rootRef={rootRef} />);

    sheenTween(sheens[0] as HTMLElement).timeline.progress(1);

    for (const sheen of sheens) {
      expect(sheen.style.transform).toBe("");
      expect(sheen.getAttribute("style") ?? "").toBe("");
    }
  });

  it("démontage pendant le balayage : calques revenus hors champ, aucun style laissé", () => {
    const { rootRef, sheens } = mountRoot();
    const view = render(<BentoRevealSignature rootRef={rootRef} />);
    const { timeline, tween } = sheenTween(sheens[0] as HTMLElement);
    timeline.seek(tween.startTime() + 1);
    // Témoin : le balayage est bien en cours.
    expect((sheens[0] as HTMLElement).style.transform).not.toBe("");

    view.unmount();

    expect(gsap.getTweensOf(sheens)).toHaveLength(0);
    for (const sheen of sheens) {
      expect(sheen.getAttribute("style") ?? "").toBe("");
    }
  });
});
