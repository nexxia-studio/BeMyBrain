import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Side } from "@/modules/core/sides";
import {
  parseTileHeights,
  TILE_HEIGHTS_COOKIE,
} from "@/modules/dashboard/tile-heights";

import { TileHeightRecorder } from "./TileHeightRecorder";

// jsdom ignore un cookie dont le chemin ne correspond pas à l'adresse (docs/gotchas.md) : `document.cookie` est
// remplacé par un témoin qui note chaque écriture et rend la valeur posée.
const cookieJar = vi.hoisted(() => ({
  read: "",
  writes: [] as string[],
}));

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

let tier = "sm";

function setHeight(element: Element, height: number) {
  (element as HTMLElement).getBoundingClientRect = () =>
    ({ height, width: 300, x: 0, y: 0, top: 0, left: 0 }) as DOMRect;
}

function Grid({ side, tiles }: { side: Side; tiles: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={rootRef} data-testid="grid" data-side={side}>
      {tiles.map((id) => (
        <section key={id} data-tile={id} />
      ))}
      <TileHeightRecorder rootRef={rootRef} />
    </div>
  );
}

/** Rend la grille ; les hauteurs sont posées avant le montage du relevé par `heights`. */
function renderGrid(
  heights: Record<string, number>,
  { side = "private" }: { side?: Side } = {},
) {
  return render(<Grid side={side} tiles={Object.keys(heights)} />);
}

function tilesOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-tile]"));
}

function lastWrite() {
  return cookieJar.writes.at(-1) ?? "";
}

function valueOf(write: string) {
  const [pair] = write.split("; ");
  return pair.slice(`${TILE_HEIGHTS_COOKIE}=`.length);
}

beforeEach(() => {
  cookieJar.read = "";
  cookieJar.writes = [];
  tier = "sm";
  FakeResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => cookieJar.read,
    set: (value: string) => {
      cookieJar.writes.push(value);
    },
  });
  const realComputed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = realComputed(element);
    if (element !== document.documentElement) return style;
    return {
      ...style,
      getPropertyValue: (name: string) =>
        name === "--tile-tier" ? tier : style.getPropertyValue(name),
    } as CSSStyleDeclaration;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // @ts-expect-error -- retire la surcharge : jsdom reprend son accesseur de Document.prototype.
  delete document.cookie;
  window.history.pushState({}, "", "/");
});

/** Monte la grille, pose les hauteurs, puis laisse l'observateur relever (premier rappel, comme le navigateur). */
function mountAndMeasure(
  heights: Record<string, number>,
  options?: { side?: Side },
) {
  const result = renderGrid(heights, options);
  const tiles = tilesOf(result.container);
  tiles.forEach((tile) => setHeight(tile, heights[tile.dataset.tile ?? ""]));
  act(() => FakeResizeObserver.instances.at(-1)?.fire());
  return { ...result, tiles };
}

describe("relevé des hauteurs de tuiles", () => {
  it("relève la boîte de chaque tuile au palier courant et l'écrit dans le cookie, attributs compris", () => {
    mountAndMeasure({ today: 312.40625, privateTodo: 480, home: 150.5 });

    const write = lastWrite();
    expect(write.split("; ").slice(1)).toEqual([
      "Path=/dashboard",
      "Max-Age=2592000",
      "SameSite=Strict",
      "Secure",
    ]);
    expect(parseTileHeights(valueOf(write))).toEqual({
      private: {
        sm: { today: 31241, privateTodo: 48000, home: 15050 },
      },
    });
  });

  it("observe chaque tuile et la grille : un redimensionnement relève à nouveau", () => {
    const { tiles, container } = mountAndMeasure({ today: 300, home: 150 });
    const observer = FakeResizeObserver.instances.at(-1);

    expect(observer?.observed).toEqual(
      expect.arrayContaining([...tiles, container.firstElementChild]),
    );

    tier = "lg";
    setHeight(tiles[0], 280);
    cookieJar.read = `${TILE_HEIGHTS_COOKIE}=${valueOf(lastWrite())}`;
    act(() => observer?.fire());

    expect(parseTileHeights(valueOf(lastWrite()))).toEqual({
      private: {
        sm: { today: 30000, home: 15000 },
        lg: { today: 28000, home: 15000 },
      },
    });
  });

  it("garde les relevés des autres côtés et paliers déjà dans le cookie", () => {
    cookieJar.read = `bmb_side=pro; ${TILE_HEIGHTS_COOKIE}=pro.md:proTodo-40000~private.lg:home-20000`;

    mountAndMeasure({ today: 300 });

    expect(parseTileHeights(valueOf(lastWrite()))).toEqual({
      private: { sm: { today: 30000 }, lg: { home: 20000 } },
      pro: { md: { proTodo: 40000 } },
    });
  });

  it("écrit au chemin du tableau de bord, jamais déduit de l'adresse", () => {
    window.history.pushState({}, "", "/tasks");

    mountAndMeasure({ today: 300 });

    expect(lastWrite()).toContain("; Path=/dashboard;");
  });

  it("relève le côté passé par la grille", () => {
    mountAndMeasure({ today: 300, proTodo: 200 }, { side: "pro" });

    expect(parseTileHeights(valueOf(lastWrite()))).toEqual({
      pro: { sm: { today: 30000, proTodo: 20000 } },
    });
  });

  it("n'écrit rien si le relevé est inchangé", () => {
    mountAndMeasure({ today: 300 });
    const observer = FakeResizeObserver.instances.at(-1);
    const count = cookieJar.writes.length;
    cookieJar.read = `${TILE_HEIGHTS_COOKIE}=${valueOf(lastWrite())}`;

    act(() => observer?.fire());

    expect(cookieJar.writes).toHaveLength(count);
  });

  it("palier illisible (feuille de style absente) : n'écrit rien", () => {
    tier = "";

    mountAndMeasure({ today: 300 });

    expect(cookieJar.writes).toEqual([]);
  });

  it("bascule en transition : l'ancien observateur qui se déclenche sur le DOM du nouveau côté, avant les effets, n'écrit rien sous l'ancien côté", () => {
    const { rerender } = mountAndMeasure({
      today: 300,
      privateTodo: 480,
      home: 150,
    });
    const before = valueOf(lastWrite());
    cookieJar.read = `${TILE_HEIGHTS_COOKIE}=${before}`;
    const oldObserver = FakeResizeObserver.instances.at(-1);

    // Nouveau DOM (côté Pro) mis en place ; l'ancien observateur se déclenche avant que les effets ne repartent.
    rerender(<Grid side="pro" tiles={["today", "proTodo"]} />);
    for (const tile of tilesOf(document.body)) setHeight(tile, 200);
    cookieJar.writes = [];
    act(() => oldObserver?.fire());

    for (const write of cookieJar.writes) {
      expect(parseTileHeights(valueOf(write)).private).toEqual(
        parseTileHeights(before).private,
      );
    }
  });

  it("une tuile qui n'appartient pas au côté rendu : rien n'est écrit", () => {
    mountAndMeasure({ today: 300, proTodo: 200 }, { side: "private" });

    expect(cookieJar.writes).toEqual([]);
  });

  it("au démontage, cesse d'observer", () => {
    const { unmount } = mountAndMeasure({ today: 300 });
    const observer = FakeResizeObserver.instances.at(-1);

    unmount();

    expect(observer?.disconnected).toBe(true);
  });
});
