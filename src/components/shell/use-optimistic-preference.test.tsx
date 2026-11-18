import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CaughtBoundary,
  expiredSessionRedirect,
} from "../../../tests/factories/next-control";

import {
  FAILURE_VISIBLE_MS,
  useOptimisticPreference,
} from "./use-optimistic-preference";

function deferred() {
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((_, rej) => {
    reject = rej;
  });
  return { promise, reject };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("préférence d'affichage optimiste", () => {
  it("n'affiche pas d'échec quand un enregistrement dépassé échoue après le succès du dernier", async () => {
    const first = deferred();
    const save = vi
      .fn<(next: string) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useOptimisticPreference<string>("private", save),
    );
    act(() => result.current.update("pro"));
    act(() => result.current.update("private"));

    await act(async () => {
      first.reject(new Error("réseau"));
      await first.promise.catch(() => {});
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.failed).toBe(false);
  });

  it("affiche l'échec du dernier enregistrement", async () => {
    const save = vi
      .fn<(next: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("réseau"));
    const { result } = renderHook(() =>
      useOptimisticPreference<string>("private", save),
    );

    act(() => result.current.update("pro"));
    act(() => result.current.update("private"));

    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  it("retire le message d'échec après FAILURE_VISIBLE_MS", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi
      .fn<(next: string) => Promise<void>>()
      .mockRejectedValue(new Error("réseau"));
    const { result } = renderHook(() =>
      useOptimisticPreference<string>("private", save),
    );
    act(() => result.current.update("pro"));
    await waitFor(() => expect(result.current.failed).toBe(true));

    act(() => vi.advanceTimersByTime(FAILURE_VISIBLE_MS / 2));
    const midway = result.current.failed;
    act(() => vi.advanceTimersByTime(FAILURE_VISIBLE_MS / 2));

    expect(midway).toBe(true);
    expect(result.current.failed).toBe(false);
  });

  it("session expirée : laisse Next naviguer vers /login, sans message d'échec", async () => {
    const control = expiredSessionRedirect();
    const save = vi
      .fn<(next: string) => Promise<void>>()
      .mockRejectedValue(control);
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { result } = renderHook(
      () => useOptimisticPreference<string>("private", save),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <CaughtBoundary onError={onError}>{children}</CaughtBoundary>
        ),
      },
    );
    const failedBefore = result.current.failed;

    act(() => result.current.update("pro"));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(control));
    expect(failedBefore).toBe(false);
    expect(result.current.failed).toBe(false);
    consoleError.mockRestore();
  });
});
