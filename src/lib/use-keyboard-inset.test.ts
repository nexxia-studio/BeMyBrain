import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useKeyboardInset } from "./use-keyboard-inset";

type Listener = () => void;

/** Faux `visualViewport` : hauteur et décalage réglables, événements `resize` et `scroll`. */
function fakeVisualViewport(height: number, offsetTop = 0) {
  const listeners = new Map<string, Set<Listener>>();
  const viewport = {
    height,
    offsetTop,
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    listenerCount: () =>
      [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  return viewport;
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
});

describe("useKeyboardInset (tiroir au-dessus du clavier)", () => {
  it("sans visualViewport : aucun décalage", () => {
    const { result } = renderHook(() => useKeyboardInset(true));

    expect(result.current).toBe(0);
  });

  it("clavier ouvert : hauteur masquée sous la zone visible", () => {
    const viewport = fakeVisualViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardInset(true));

    act(() => {
      viewport.height = window.innerHeight - 300;
      viewport.emit("resize");
    });

    expect(result.current).toBe(300);
  });

  it("zone visible défilée (iOS) : le décalage en tient compte", () => {
    const viewport = fakeVisualViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardInset(true));

    act(() => {
      viewport.height = window.innerHeight - 300;
      viewport.offsetTop = 100;
      viewport.emit("scroll");
    });

    expect(result.current).toBe(200);
  });

  it("jamais négatif (zone visible plus haute que la page)", () => {
    fakeVisualViewport(window.innerHeight + 40);

    const { result } = renderHook(() => useKeyboardInset(true));

    expect(result.current).toBe(0);
  });

  it("inactif (tiroir fermé) : n'écoute pas et ne décale rien", () => {
    const viewport = fakeVisualViewport(window.innerHeight - 300);

    const { result } = renderHook(() => useKeyboardInset(false));

    expect(result.current).toBe(0);
    expect(viewport.listenerCount()).toBe(0);
  });

  it("se désabonne au démontage", () => {
    const viewport = fakeVisualViewport(window.innerHeight);
    const { unmount } = renderHook(() => useKeyboardInset(true));

    unmount();

    expect(viewport.listenerCount()).toBe(0);
  });
});
