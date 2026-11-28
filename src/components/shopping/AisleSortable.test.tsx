import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AISLE_KEYS, type AisleKey } from "@/modules/shopping/aisles";
import type { AisleGroup } from "@/modules/shopping/list-view";

import fr from "../../../messages/fr.json";

const setShoppingAisleOrder = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/lists/shopping/actions", () => ({
  setShoppingAisleOrder,
}));

import { AisleSortable } from "./AisleSortable";

const group = (aisleKey: AisleKey): AisleGroup => ({ aisleKey, items: [] });

function renderSortable(keys: AisleKey[]) {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AisleSortable
        aisles={keys.map(group)}
        renderAisle={(aisle, handle) => (
          <section data-testid={`aisle-${aisle.aisleKey}`}>
            {handle}
            <h2>{aisle.aisleKey}</h2>
          </section>
        )}
      />
    </NextIntlClientProvider>,
  );
}

// jsdom ne calcule aucune géométrie : rayons empilés (150 px de haut, un tous les 200 px).
function fakeRect(this: Element): DOMRect {
  const wrapper = this.closest("[data-aisle-sortable]");
  const all = [...document.querySelectorAll("[data-aisle-sortable]")];
  const y = wrapper ? all.indexOf(wrapper) * 200 : 0;
  const height = wrapper ? 150 : 0;
  return {
    x: 0,
    y,
    left: 0,
    top: y,
    width: 300,
    height,
    right: 300,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  setShoppingAisleOrder.mockReset();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    fakeRect,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const handle = (key: AisleKey) =>
  screen.getByRole("button", {
    name: fr.shopping.aisleSort.handle.replace(
      "{aisle}",
      fr.shopping.aisles[key],
    ),
  });

const order = () =>
  [...document.querySelectorAll("[data-aisle-sortable]")].map((el) =>
    el.getAttribute("data-aisle-sortable"),
  );

async function press(target: Element, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function moveDown(key: AisleKey) {
  handle(key).focus();
  await press(handle(key), "Space");
  await press(handle(key), "ArrowDown");
  await press(handle(key), "Space");
}

describe("AisleSortable", () => {
  it("l'ordre change et est enregistré par setAisleOrder, avec les 12 clés", async () => {
    // Action en attente : sans rendu serveur, `useOptimistic` retomberait sur la prop dès qu'elle se résout
    // (gotcha) ; l'ordre se lit donc pendant l'enregistrement.
    let resolve!: (value: { ok: true; result: null }) => void;
    setShoppingAisleOrder.mockReturnValue(new Promise((r) => (resolve = r)));
    renderSortable(["produce", "drinks", "frozen"]);

    await moveDown("produce");

    expect(order()).toEqual(["drinks", "produce", "frozen"]);
    expect(setShoppingAisleOrder).toHaveBeenCalledTimes(1);
    const saved = setShoppingAisleOrder.mock.calls[0][0] as AisleKey[];
    expect(saved).toHaveLength(12);
    expect([...saved].sort()).toEqual([...AISLE_KEYS].sort());
    expect(
      saved.filter((k) => ["produce", "drinks", "frozen"].includes(k)),
    ).toEqual(["drinks", "produce", "frozen"]);
    await act(async () => resolve({ ok: true, result: null }));
  });

  it("l'échec rend l'ordre d'avant avec message", async () => {
    setShoppingAisleOrder.mockRejectedValue(new Error("panne"));
    renderSortable(["produce", "drinks", "frozen"]);

    await moveDown("produce");

    expect(
      await screen.findByText(fr.shopping.aisleSort.notSaved),
    ).toBeDefined();
    expect(order()).toEqual(["produce", "drinks", "frozen"]);
  });

  it("un refus du serveur rend aussi l'ordre d'avant avec message", async () => {
    setShoppingAisleOrder.mockResolvedValue({ ok: false });
    renderSortable(["produce", "drinks"]);

    await moveDown("produce");

    expect(
      await screen.findByText(fr.shopping.aisleSort.notSaved),
    ).toBeDefined();
    expect(order()).toEqual(["produce", "drinks"]);
  });

  it("aucun aimant de défilement pendant un glisser", async () => {
    setShoppingAisleOrder.mockResolvedValue({ ok: true, result: null });
    const { container } = renderSortable(["produce", "drinks"]);
    const snaps = () =>
      [container, ...container.querySelectorAll("*")].filter((el) =>
        /(^|\s)(snap-|scroll-snap)/.test(el.getAttribute("class") ?? ""),
      );

    handle("produce").focus();
    await press(handle("produce"), "Space");
    expect(handle("produce").getAttribute("aria-pressed")).toBe("true");
    expect(snaps()).toHaveLength(0);
    await press(handle("produce"), "Escape");
  });

  it("Échap annule : rien n'est enregistré", async () => {
    renderSortable(["produce", "drinks"]);

    handle("produce").focus();
    await press(handle("produce"), "Space");
    await press(handle("produce"), "ArrowDown");
    await press(handle("produce"), "Escape");

    expect(order()).toEqual(["produce", "drinks"]);
    expect(setShoppingAisleOrder).not.toHaveBeenCalled();
  });

  it("un seul rayon : pas de poignée", () => {
    renderSortable(["produce"]);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
