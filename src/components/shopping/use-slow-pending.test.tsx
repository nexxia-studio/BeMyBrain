import { act, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";
import { SavingStatus } from "./SavingStatus";
import { useSlowPending } from "./use-slow-pending";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useSlowPending", () => {
  it("reste faux à 999 ms, vrai à 1000 ms", () => {
    const { result } = renderHook(() => useSlowPending(true, 1000));
    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("retombe à faux dès que l'écriture se termine", () => {
    const { result, rerender } = renderHook(
      ({ p }) => useSlowPending(p, 1000),
      { initialProps: { p: true } },
    );
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(true);
    rerender({ p: false });
    expect(result.current).toBe(false);
  });

  it("n'apparaît jamais pour une écriture rapide", () => {
    const { result, rerender } = renderHook(
      ({ p }) => useSlowPending(p, 1000),
      { initialProps: { p: true } },
    );
    act(() => vi.advanceTimersByTime(400));
    rerender({ p: false });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
  });

  it("nettoie le minuteur au démontage", () => {
    const { unmount } = renderHook(() => useSlowPending(true, 1000));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("SavingStatus", () => {
  it("garde la région montée et n'écrit le texte qu'après 1 s", () => {
    const view = (pending: boolean) => (
      <NextIntlClientProvider locale="fr" messages={messages}>
        <SavingStatus pending={pending} />
      </NextIntlClientProvider>
    );
    const { rerender } = render(view(true));
    const region = screen.getByTestId("saving-status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    act(() => vi.advanceTimersByTime(999));
    expect(region.textContent).toBe("");
    act(() => vi.advanceTimersByTime(1));
    expect(region.textContent).toBe("Enregistrement…");
    rerender(view(false));
    expect(screen.getByTestId("saving-status")).toBe(region);
    expect(region.textContent).toBe("");
  });
});
