import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  BoardColumn,
  BoardMove,
  CardState,
} from "@/components/kanban/SortableBoard";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";

type BoardProps = {
  columns: readonly BoardColumn<{ id: string }>[];
  renderCard: (item: { id: string }, state: CardState) => ReactNode;
  onMove: (move: BoardMove) => void;
  activationDelayMs?: number;
  layout?: "scroll" | "tabs";
};

// Double du tableau : le glisser lui-même est couvert par SortableBoard.test.tsx. Ici, chaque colonne rend ses
// cartes et son pied ; `boardProps.current` donne les dernières props, pour déposer une carte par `onMove`.
const boardProps = vi.hoisted(() => ({ current: null as BoardProps | null }));
const animate = vi.hoisted(() => vi.fn());
const reducedMotion = vi.hoisted(() => ({ current: false }));

vi.mock("@/components/kanban/SortableBoard", () => ({
  SortableBoard: (props: BoardProps) => {
    boardProps.current = props;
    return props.columns.map((column) => (
      <section
        key={column.id}
        data-column={column.id}
        aria-label={column.label}
      >
        {column.collapsed
          ? null
          : column.items.map((item) => (
              <div key={item.id}>
                {props.renderCard(item, { dragging: false, overlay: false })}
              </div>
            ))}
        {column.collapsed ? null : column.footer}
      </section>
    ));
  },
}));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  animate,
  useReducedMotion: () => reducedMotion.current,
}));

import { getUserTimeZone } from "@/modules/core/time-zone";

import { KanbanDemo } from "./KanbanDemo";

const TODAY = "2026-11-24";
// Ids des tâches fictives : `<statut>-<rang>` (demo-fixtures.ts). `unstarted-1` : « Rappeler le plombier ».
const PLUMBER = "unstarted-1";
const TO_STARTED_HEAD: BoardMove = {
  id: PLUMBER,
  toColumn: "started",
  beforeId: null,
  afterId: "started-1",
};

function renderDemo(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone={getUserTimeZone()}
    >
      <KanbanDemo today={TODAY} />
    </NextIntlClientProvider>,
  );
}

function idsIn(status: string) {
  return [
    ...document.querySelectorAll(`[data-column="${status}"] [data-demo-card]`),
  ].map((card) => card.getAttribute("data-demo-card"));
}

function columnIds(status: string) {
  return boardProps
    .current!.columns.find((column) => column.id === status)!
    .items.map((item) => item.id);
}

async function drop(move: BoardMove) {
  await act(async () => boardProps.current!.onMove(move));
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// jsdom ne calcule aucune géométrie : chaque colonne est décalée de 300 px, chaque carte de 60 px.
function fakeRect(this: Element): DOMRect {
  const column = this.closest("[data-column]");
  const columns = [...document.querySelectorAll("[data-column]")];
  const cards = column ? [...column.querySelectorAll("[data-demo-card]")] : [];
  const left = columns.indexOf(column!) * 300;
  const top = cards.indexOf(this) * 60;
  return { left, top, x: left, y: top, width: 260, height: 50 } as DOMRect;
}

// Animations de Motion jouées instantanément (sortie de la bulle) : sous horloge factice, sa boucle d'images
// n'avance pas de façon fiable. Le retour de la carte passe par `animate`, remplacé plus haut.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion.current = false;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    fakeRect,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  animate.mockClear();
});

describe("démo du kanban", () => {
  it("affiche les cinq colonnes sous les libellés de statut, Annulée repliée", () => {
    renderDemo();

    expect(boardProps.current!.columns.map((column) => column.label)).toEqual([
      "À planifier",
      "À faire",
      "En cours",
      "Terminée",
      "Annulée",
    ]);
    expect(
      boardProps.current!.columns.map((column) => column.collapsed ?? false),
    ).toEqual([false, false, false, false, true]);
  });

  it("limite Terminée aux 20 plus récentes, avec son total, et montre tout sur demande", () => {
    renderDemo();
    const done = () =>
      boardProps.current!.columns.find((column) => column.id === "completed")!;

    expect(done().items).toHaveLength(20);
    expect(done().total).toBe(24);

    fireEvent.click(screen.getByRole("button", { name: "Tout voir (24)" }));

    expect(done().items).toHaveLength(24);
    expect(
      screen.getByRole("button", { name: "Voir les 20 plus récentes" }),
    ).toBeDefined();
  });

  it("marque une carte bloquée et écrit en braise l'échéance d'une carte en retard", () => {
    renderDemo();
    const plumber = document.querySelector(`[data-demo-card="${PLUMBER}"]`)!;

    expect(within(plumber as HTMLElement).getByText("Bloquée")).toBeDefined();
    expect(
      within(plumber as HTMLElement)
        .getByText("En retard")
        .closest(".text-destructive"),
    ).not.toBeNull();
  });

  it("garde la carte là où elle est lâchée pendant l'enregistrement", async () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "1 s" }));

    await drop(TO_STARTED_HEAD);

    expect(idsIn("started")[0]).toBe(PLUMBER);
    expect(screen.getByRole("status").textContent).toBe(
      "1 déplacement en cours d'enregistrement…",
    );

    await wait(1000);

    expect(idsIn("started")[0]).toBe(PLUMBER);
    expect(idsIn("unstarted")).not.toContain(PLUMBER);
    expect(screen.getByRole("status").textContent).toBe("Tout est enregistré.");
  });

  it("enregistre les déplacements enchaînés l'un après l'autre, dans l'ordre", async () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "1 s" }));

    await drop(TO_STARTED_HEAD);
    await drop({
      id: PLUMBER,
      toColumn: "completed",
      beforeId: null,
      afterId: "completed-1",
    });
    await wait(1000);

    expect(screen.getByRole("status").textContent).toBe(
      "1 déplacement en cours d'enregistrement…",
    );

    await wait(1000);

    expect(idsIn("completed")[0]).toBe(PLUMBER);
    expect(screen.getByRole("status").textContent).toBe("Tout est enregistré.");
  });

  it("à l'échec simulé, ramène la carte à sa place, l'anime depuis l'endroit du dépôt et propose de réessayer", async () => {
    renderDemo();
    const failNext = screen.getByRole("switch", {
      name: "Faire échouer le prochain dépôt",
    });
    fireEvent.click(failNext);
    const before = columnIds("unstarted");

    await drop(TO_STARTED_HEAD);

    expect(idsIn("started")[0]).toBe(PLUMBER);
    expect(failNext.getAttribute("aria-checked")).toBe("false");

    await wait(0);

    expect(columnIds("unstarted")).toEqual(before);
    expect(idsIn("started")).not.toContain(PLUMBER);
    // Lâchée en tête de « En cours » (colonne 3), revenue en tête de « À faire » (colonne 2) : départ à +300 px.
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0][0]).toBe(
      document.querySelector(`[data-demo-card="${PLUMBER}"]`),
    );
    expect(animate.mock.calls[0][1]).toEqual({ x: [300, 0], y: [0, 0] });
    expect(screen.getByText("Déplacement non enregistré.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(idsIn("started")[0]).toBe(PLUMBER);
    // Enregistrement (latence nulle) et sortie de la bulle.
    await wait(0);
    await wait(0);

    expect(screen.queryByText("Déplacement non enregistré.")).toBeNull();
    expect(idsIn("started")[0]).toBe(PLUMBER);
  });

  it("n'affiche ni bulle ni Réessayer pour l'échec d'un déplacement dépassé par un dépôt plus récent de la même carte", async () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "1 s" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "Faire échouer le prochain dépôt" }),
    );

    await drop(TO_STARTED_HEAD);
    await drop({
      id: PLUMBER,
      toColumn: "completed",
      beforeId: null,
      afterId: "completed-1",
    });
    await wait(2000);

    expect(idsIn("completed")[0]).toBe(PLUMBER);
    expect(idsIn("started")).not.toContain(PLUMBER);
    expect(screen.queryByText("Déplacement non enregistré.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it("à l'échec d'une carte, garde à sa place la carte déposée juste sous elle", async () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "1 s" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "Faire échouer le prochain dépôt" }),
    );
    const startedBefore = columnIds("started");

    await drop(TO_STARTED_HEAD);
    await drop({
      id: "unstarted-2",
      toColumn: "started",
      beforeId: PLUMBER,
      afterId: "started-1",
    });
    await wait(2000);

    expect(columnIds("started")).toEqual(["unstarted-2", ...startedBefore]);
    expect(columnIds("unstarted")[0]).toBe(PLUMBER);
    expect(screen.getByText("Déplacement non enregistré.")).toBeDefined();
  });

  it("garde affichée la carte lâchée sous la 20e de Terminée", async () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "1 s" }));

    await drop({
      id: PLUMBER,
      toColumn: "completed",
      beforeId: "completed-20",
      afterId: null,
    });

    expect(idsIn("completed").at(-1)).toBe(PLUMBER);

    await wait(1000);

    expect(idsIn("completed")).toHaveLength(21);
    expect(idsIn("completed").at(-1)).toBe(PLUMBER);
    expect(
      screen.getByRole("button", { name: "Tout voir (25)" }),
    ).toBeDefined();
  });

  it("efface la bulle d'échec après 5 s", async () => {
    renderDemo();
    fireEvent.click(
      screen.getByRole("switch", { name: "Faire échouer le prochain dépôt" }),
    );
    await drop(TO_STARTED_HEAD);
    await wait(0);

    await wait(4999);

    expect(screen.getByText("Déplacement non enregistré.")).toBeDefined();

    await wait(1);
    await wait(0);

    expect(screen.queryByText("Déplacement non enregistré.")).toBeNull();
  });

  it("ramène la carte sans animation quand le mouvement est réduit", async () => {
    reducedMotion.current = true;
    renderDemo();
    fireEvent.click(
      screen.getByRole("switch", { name: "Faire échouer le prochain dépôt" }),
    );

    await drop(TO_STARTED_HEAD);
    await wait(0);

    expect(idsIn("unstarted")[0]).toBe(PLUMBER);
    expect(animate).not.toHaveBeenCalled();
  });

  it("transmet au tableau la mise en page et le délai d'appui choisis", () => {
    renderDemo();

    expect(boardProps.current!.layout).toBe("scroll");
    expect(boardProps.current!.activationDelayMs).toBe(250);

    fireEvent.click(screen.getByRole("button", { name: "Onglets" }));
    fireEvent.click(screen.getByRole("button", { name: "Long" }));

    expect(boardProps.current!.layout).toBe("tabs");
    expect(boardProps.current!.activationDelayMs).toBe(400);
    expect(
      screen.getByRole("button", { name: "Long" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("affiche ses réglages et ses colonnes en anglais", () => {
    renderDemo("en");

    expect(screen.getByText("Settings")).toBeDefined();
    expect(
      screen.getByRole("switch", { name: "Fail the next drop" }),
    ).toBeDefined();
    expect(boardProps.current!.columns.map((column) => column.label)).toEqual([
      "To plan",
      "To do",
      "In progress",
      "Done",
      "Canceled",
    ]);
  });
});
