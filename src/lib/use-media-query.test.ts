import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "./use-media-query";

function stubMatchMedia(initial: boolean) {
  const state = { matches: initial, listeners: new Set<() => void>() };
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return state.matches;
    },
    addEventListener: (_type: string, listener: () => void) =>
      state.listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      state.listeners.delete(listener),
  }));
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("sans matchMedia (jsdom) : faux, variante mobile", () => {
    vi.stubGlobal("matchMedia", undefined);

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));

    expect(result.current).toBe(false);
  });

  it("suit la requête quand la largeur change", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);

    act(() => {
      media.matches = true;
      media.listeners.forEach((listener) => listener());
    });

    expect(result.current).toBe(true);
  });
});
