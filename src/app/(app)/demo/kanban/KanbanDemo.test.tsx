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
  onOpen?: (id: string) => void;
  onCollapsedChange?: (columnId: string, collapsed: boolean) => void;
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

// Démo sans base ni action serveur : charger le registre d'actions (même indirectement) fait échouer ce fichier.
vi.mock("@/app/(app)/tasks/actions", () => {
  throw new Error("registre d'actions chargé par la démo");
});
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

import { getUserTimeZone } from "@/modules/core/time-zone";

import {
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TINT_CLASSES,
} from "@/components/tasks/priority-icons";

import { demoTasks } from "./demo-fixtures";
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

function cardClasses(id: string) {
  return document
    .querySelector(`[data-demo-card="${id}"]`)!
    .className.split(/\s+/);
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

  it("seule Annulée est repliable ; le tableau la déplie puis la replie, ses cartes fictives suivent", () => {
    renderDemo();
    const canceled = () =>
      boardProps.current!.columns.find((column) => column.id === "canceled")!;
    const shown = () =>
      document.querySelectorAll('[data-column="canceled"] [data-demo-card]')
        .length;
    expect(
      boardProps.current!.columns.map((column) => column.collapsible ?? false),
    ).toEqual([false, false, false, false, true]);
    expect(shown()).toBe(0);

    act(() => boardProps.current!.onCollapsedChange!("canceled", false));

    expect(canceled().collapsed).toBe(false);
    expect(shown()).toBe(canceled().items.length);
    expect(shown()).toBeGreaterThan(0);

    act(() => boardProps.current!.onCollapsedChange!("canceled", true));

    expect(canceled().collapsed).toBe(true);
    expect(shown()).toBe(0);
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

  it("ne propose que la latence et l'échec simulé : mise en page et délai d'appui sont fixés par le tableau", () => {
    renderDemo();

    expect(
      screen.getByRole("group", { name: "Latence simulée" }),
    ).toBeDefined();
    expect(screen.queryByRole("group", { name: "Mise en page" })).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Appui avant saisie" }),
    ).toBeNull();
    expect(boardProps.current).not.toHaveProperty("layout");
    expect(boardProps.current).not.toHaveProperty("activationDelayMs");
  });

  it("cartes opaques bordées avec ombre légère ; les surfaces du tableau ne se règlent plus (Creux, fixé par le tableau)", () => {
    renderDemo();

    expect(boardProps.current).not.toHaveProperty("surface");
    expect(cardClasses(PLUMBER)).toEqual(
      expect.arrayContaining([
        "bg-popover",
        "border",
        "border-border",
        "shadow-raised",
      ]),
    );
    expect(screen.queryByRole("group", { name: "Cartes" })).toBeNull();
  });

  it("carte ouverte : légende en pleine couleur", () => {
    renderDemo();

    const legend = document.querySelector(
      `[data-demo-card="${PLUMBER}"] [data-card-legend]`,
    )!;
    expect(legend.className.split(/\s+/)).not.toContain("grayscale");
  });

  it("carte terminée : la légende perd ses couleurs avec le titre atténué, sans opacité (contraste gardé)", () => {
    renderDemo();

    const card = document.querySelector('[data-demo-card="completed-1"]')!;
    const legend = card.querySelector("[data-card-legend]")!;
    expect(legend.className.split(/\s+/)).toContain("grayscale");
    expect(legend.className).not.toMatch(/opacity/);
    expect(card.firstElementChild!.className.split(/\s+/)).toContain(
      "text-muted-foreground",
    );
  });

  it("une carte déposée dans Terminée perd les couleurs de sa légende", async () => {
    renderDemo();

    act(() =>
      boardProps.current!.onMove({
        id: PLUMBER,
        toColumn: "completed",
        beforeId: null,
        afterId: "completed-1",
      }),
    );

    const legend = document.querySelector(
      `[data-demo-card="${PLUMBER}"] [data-card-legend]`,
    )!;
    expect(legend.className.split(/\s+/)).toContain("grayscale");
  });

  it("calque du glisser : même carte bordée, sans ombre propre (celle du calque suffit)", () => {
    renderDemo();
    const { container } = render(
      <NextIntlClientProvider
        locale="fr"
        messages={fr}
        timeZone={getUserTimeZone()}
      >
        {boardProps.current!.renderCard(
          boardProps
            .current!.columns.flatMap((column) => column.items)
            .find((item) => item.id === PLUMBER)!,
          { dragging: true, overlay: true },
        )}
      </NextIntlClientProvider>,
    );

    const classes = (
      container.firstElementChild as HTMLElement
    ).className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining(["bg-popover", "border", "border-border"]),
    );
    expect(classes).not.toContain("shadow-raised");
  });

  it("accroche l'icône de priorité d'une carte à la dernière information de sa légende", () => {
    renderDemo();
    // `unstarted-3` : priorité Haute, avec espace, échéance ou tags avant elle.
    const card = document.querySelector(
      '[data-demo-card="unstarted-3"]',
    ) as HTMLElement;
    const group = card.querySelector("[data-legend-group]") as HTMLElement;

    expect(group.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex", "flex-nowrap", "min-w-0"]),
    );
    expect(group.children).toHaveLength(2);
    expect(within(group).getByText("Priorité haute")).toBeDefined();
  });

  it("montre la priorité d'une carte en badge teinté à icône, rien pour une carte sans priorité", () => {
    renderDemo();
    const cards = [
      ...document.querySelectorAll<HTMLElement>("[data-demo-card]"),
    ];
    const tinted = cards.filter(
      (card) => card.querySelector("[class*='bg-priority-']") !== null,
    );

    // `unstarted-3` : priorité Haute.
    const card = document.querySelector(
      '[data-demo-card="unstarted-3"]',
    ) as HTMLElement;
    const badge = within(card).getByText("Priorité haute").parentElement!;

    expect(badge.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        ...PRIORITY_BADGE_CLASSES.split(" "),
        ...PRIORITY_TINT_CLASSES[2].split(" "),
      ]),
    );
    const svg = badge.querySelector("svg.lucide-signal-high")!;
    expect(svg.classList.contains("text-foreground")).toBe(false);
    // Un badge sur chaque carte à priorité 1 à 4, aucun pour 0.
    const priorities = new Map(
      demoTasks(TODAY).map((task) => [task.id, task.priority]),
    );
    for (const each of cards) {
      const priority = priorities.get(each.dataset.demoCard!)!;
      expect(tinted.includes(each)).toBe(priority >= 1 && priority <= 4);
    }
    expect(tinted.length).toBeLessThan(cards.length);
  });

  it("affiche ses réglages et ses colonnes en anglais", () => {
    renderDemo("en");

    expect(screen.queryByRole("group", { name: "Cards" })).toBeNull();
    expect(
      screen.getByRole("group", { name: "Simulated latency" }),
    ).toBeDefined();
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

/** `a` est avant `b` dans le document. */
function precedes(a: Element, b: Element) {
  return Boolean(
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

// `backlog-1` : carte sans notes ni sous-tâches.
const NO_NOTES = "backlog-1";
// `unstarted-3` : « Préparer la démo du kanban… », notes et trois sous-tâches (une faite), priorité Haute.
const DEMO_PREP = "unstarted-3";

async function openCard(id: string) {
  await act(async () => boardProps.current!.onOpen!(id));
}

function detail() {
  return screen.getByRole("dialog", { name: fr.tasks.detail.label });
}

async function choose(chipName: RegExp, option: string) {
  fireEvent.click(within(detail()).getByRole("button", { name: chipName }));
  await wait(0);
  fireEvent.click(screen.getByRole("menuitemradio", { name: option }));
  await wait(0);
}

/** Sélecteur « Détail » (Nouveau / Actuel), dans la fenêtre du détail. */
function layoutChoice(name: string) {
  return within(
    within(detail()).getByRole("group", { name: "Détail" }),
  ).getByRole("button", { name });
}

async function closeDetail() {
  fireEvent.click(
    within(detail()).getByRole("button", { name: fr.tasks.detail.close }),
  );
  await wait(0);
}

describe("démo du kanban : détail d'une carte", () => {
  it("ouvre le détail de la carte : titre, statut, priorité, notes, échéance, tags, sous-tâches", async () => {
    renderDemo();

    await openCard(DEMO_PREP);

    const dialog = within(detail());
    expect(
      dialog.getByRole("heading", { name: /^Préparer la démo du kanban/ }),
    ).toBeTruthy();
    expect(
      dialog.getByRole("button", { name: "Statut : À faire" }),
    ).toBeTruthy();
    expect(
      dialog.getByRole("button", { name: "Priorité : Haute" }),
    ).toBeTruthy();
    expect(
      (dialog.getByLabelText(fr.tasks.detail.notes) as HTMLTextAreaElement)
        .value,
    ).toMatch(/^Tap court/);
    expect(dialog.getByRole("button", { name: /^Échéance/ })).toBeTruthy();
    expect(dialog.getByRole("button", { name: "Tags : produit" })).toBeTruthy();
    expect(
      dialog.getByRole("heading", { name: fr.tasks.detail.subtasks.title }),
    ).toBeTruthy();
    expect(dialog.getByText("1/3")).toBeTruthy();
    expect(dialog.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("changer le statut dans le détail déplace la carte en tête de la nouvelle colonne", async () => {
    renderDemo();
    await openCard(DEMO_PREP);

    await choose(/^Statut :/, "En cours");

    expect(idsIn("started")[0]).toBe(DEMO_PREP);
    expect(idsIn("unstarted")).not.toContain(DEMO_PREP);
    expect(
      within(detail()).getByRole("button", { name: "Statut : En cours" }),
    ).toBeTruthy();
  });

  it("changer la priorité dans le détail se voit sur la carte", async () => {
    renderDemo();
    await openCard(DEMO_PREP);

    await choose(/^Priorité :/, "Urgente");

    const card = document.querySelector(`[data-demo-card="${DEMO_PREP}"]`)!;
    expect(card.textContent).toContain(fr.tasks.list.priority["1"]);
  });

  it("la pastille Priorité du détail prend la teinte du niveau, et la pastille neutre au drapeau pour « Aucune »", async () => {
    renderDemo();
    await openCard(DEMO_PREP);

    const tinted = within(detail()).getByRole("button", {
      name: "Priorité : Haute",
    });
    expect(tinted.className.split(/\s+/)).toEqual(
      expect.arrayContaining(PRIORITY_TINT_CLASSES[2].split(" ")),
    );
    expect(tinted.querySelector("svg.lucide-signal-high")).not.toBeNull();

    await choose(/^Priorité :/, "Aucune");

    const neutral = within(detail()).getByRole("button", {
      name: "Priorité : Aucune",
    });
    expect(neutral.className).not.toContain("priority");
    expect(neutral.querySelector("svg.lucide-flag")).not.toBeNull();
  });

  it("le menu Priorité du détail porte un badge teinté par niveau", async () => {
    renderDemo();
    await openCard(DEMO_PREP);

    fireEvent.click(
      within(detail()).getByRole("button", { name: /^Priorité :/ }),
    );
    await wait(0);

    for (const [name, level] of [
      ["Urgente", 1],
      ["Haute", 2],
      ["Moyenne", 3],
      ["Basse", 4],
    ] as const) {
      const item = screen.getByRole("menuitemradio", { name });
      const badge = item.querySelector("[class*='bg-priority-']")!;
      expect(badge.className.split(/\s+/)).toEqual(
        expect.arrayContaining([
          ...PRIORITY_BADGE_CLASSES.split(" "),
          ...PRIORITY_TINT_CLASSES[level].split(" "),
        ]),
      );
    }
    expect(
      screen
        .getByRole("menuitemradio", { name: "Aucune" })
        .querySelector("[class*='bg-priority-']"),
    ).toBeNull();
  });

  it("garde notes et sous-tâches cochées après fermeture puis réouverture", async () => {
    renderDemo();
    await openCard(DEMO_PREP);
    fireEvent.change(within(detail()).getByLabelText(fr.tasks.detail.notes), {
      target: { value: "Retour d'Antoine" },
    });
    fireEvent.click(within(detail()).getAllByRole("checkbox")[1]);

    await closeDetail();
    expect(screen.queryByRole("dialog")).toBeNull();
    await openCard(DEMO_PREP);

    expect(
      (
        within(detail()).getByLabelText(
          fr.tasks.detail.notes,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("Retour d'Antoine");
    expect(within(detail()).getByText("2/3")).toBeTruthy();
  });

  it("carte sans sous-tâche : le champ « Ajouter une sous-tâche » est là, Entrée ajoute dans l'état local", async () => {
    renderDemo();
    await openCard(PLUMBER);
    const field = within(detail()).getByRole("textbox", {
      name: fr.tasks.detail.subtasks.add,
    }) as HTMLInputElement;
    expect(within(detail()).queryAllByRole("checkbox")).toHaveLength(0);

    field.focus();
    fireEvent.change(field, { target: { value: "  Couper l'eau  " } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    await wait(0);

    expect(within(detail()).getByText("Couper l'eau")).toBeTruthy();
    expect(within(detail()).getByText("0/1")).toBeTruthy();
    expect(field.value).toBe("");
    expect(document.activeElement).toBe(field);
  });

  it("ajoute à la suite des sous-tâches : compteur « n/m » à jour, gardé après réouverture", async () => {
    renderDemo();
    await openCard(DEMO_PREP);
    const field = within(detail()).getByRole("textbox", {
      name: fr.tasks.detail.subtasks.add,
    });

    for (const title of ["Corriger", "Montrer à Antoine"]) {
      fireEvent.change(field, { target: { value: title } });
      fireEvent.submit(field.closest("form") as HTMLFormElement);
      await wait(0);
    }
    fireEvent.click(within(detail()).getAllByRole("checkbox")[4]);

    await closeDetail();
    await openCard(DEMO_PREP);
    expect(within(detail()).getByText("2/5")).toBeTruthy();
    expect(
      within(detail())
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Essai sur iPhone",
      "Essai sur ordinateur",
      "Noter les retours",
      "Corriger",
      "Montrer à Antoine",
    ]);
  });

  it("propose les tags des autres cartes dans la pastille Tags", async () => {
    renderDemo();
    await openCard(PLUMBER);

    fireEvent.click(within(detail()).getByRole("button", { name: /^Tags :/ }));
    await wait(0);

    expect(
      screen.getByRole("button", { name: "finances", pressed: false }),
    ).toBeTruthy();
  });

  it("affiche le détail en anglais", async () => {
    renderDemo("en");

    await openCard(DEMO_PREP);

    const dialog = within(
      screen.getByRole("dialog", { name: en.tasks.detail.label }),
    );
    expect(dialog.getByRole("button", { name: "Status: To do" })).toBeTruthy();
    expect(dialog.getByLabelText(en.tasks.detail.notes)).toBeTruthy();
  });
  it("détail « Nouveau » par défaut : titre, propriétés, sous-tâches, puis notes", async () => {
    renderDemo();

    await openCard(DEMO_PREP);

    expect(layoutChoice("Nouveau").getAttribute("aria-pressed")).toBe("true");
    expect(layoutChoice("Actuel").getAttribute("aria-pressed")).toBe("false");
    const dialog = within(detail());
    const blocks = [
      dialog.getByRole("heading", { name: /^Préparer la démo du kanban/ }),
      dialog.getByRole("group", { name: fr.tasks.detail.properties }),
      dialog.getByRole("heading", { name: fr.tasks.detail.subtasks.title }),
      dialog.getByLabelText(fr.tasks.detail.notes),
    ];
    blocks.slice(1).forEach((block, index) => {
      expect(precedes(blocks[index], block)).toBe(true);
    });
    expect(
      dialog
        .getByRole("button", { name: "Statut : À faire" })
        .querySelector("svg.lucide-circle"),
    ).not.toBeNull();
  });

  it("détail « Nouveau » : notes vides repliées, notes remplies dépliées", async () => {
    renderDemo();

    await openCard(NO_NOTES);
    const empty = within(detail()).getByLabelText(fr.tasks.detail.notes);
    expect(empty.getAttribute("data-collapsed")).toBe("true");
    expect(empty.getAttribute("placeholder")).toBe("Ajouter une note");
    await closeDetail();
    await openCard(DEMO_PREP);

    expect(
      within(detail())
        .getByLabelText(fr.tasks.detail.notes)
        .getAttribute("data-collapsed"),
    ).toBe("false");
  });

  it("détail « Actuel » au sélecteur : notes en grand cadre sous le titre, avant les champs, icône de champ au statut", async () => {
    renderDemo();
    await openCard(PLUMBER);

    fireEvent.click(layoutChoice("Actuel"));

    const dialog = within(detail());
    const notes = dialog.getByLabelText(
      fr.tasks.detail.notes,
    ) as HTMLTextAreaElement;
    const status = dialog.getByRole("button", { name: /^Statut :/ });
    expect(precedes(notes, status)).toBe(true);
    expect(
      precedes(
        status,
        dialog.getByRole("heading", { name: fr.tasks.detail.subtasks.title }),
      ),
    ).toBe(true);
    expect(notes.rows).toBe(3);
    expect(notes.hasAttribute("data-collapsed")).toBe(false);
    expect(status.querySelector("svg.lucide-circle-dot")).not.toBeNull();
  });

  it("détail « Nouveau » : espaces seuls dans les notes puis champ quitté, aucune note rangée, invite de retour", async () => {
    renderDemo();
    await openCard(NO_NOTES);
    const notes = within(detail()).getByLabelText(
      fr.tasks.detail.notes,
    ) as HTMLTextAreaElement;

    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: "   " } });
    fireEvent.blur(notes);

    expect(notes.value).toBe("");
    await closeDetail();
    await openCard(NO_NOTES);
    expect(
      within(detail())
        .getByLabelText(fr.tasks.detail.notes)
        .getAttribute("data-collapsed"),
    ).toBe("true");
  });

  it("sélecteur Détail dans la fenêtre du détail, en haut, plus dans les réglages ; zones de 44 px", async () => {
    renderDemo();
    expect(screen.queryByRole("group", { name: "Détail" })).toBeNull();

    await openCard(DEMO_PREP);

    const group = within(detail()).getByRole("group", { name: "Détail" });
    expect(group.closest("details")).toBeNull();
    expect(
      precedes(
        group,
        within(detail()).getByRole("heading", {
          name: /^Préparer la démo du kanban/,
        }),
      ),
    ).toBe(true);
    for (const name of ["Nouveau", "Actuel"]) {
      expect(layoutChoice(name).className.split(/\s+/)).toContain("min-h-11");
    }
  });

  it("bascule du sélecteur : le détail reste ouvert sur la même carte, le focus reste sur le choix, aller et retour", async () => {
    renderDemo();
    await openCard(DEMO_PREP);
    const before = detail();
    const current = layoutChoice("Actuel");

    current.focus();
    fireEvent.click(current);

    expect(detail()).toBe(before);
    expect(layoutChoice("Actuel")).toBe(current);
    expect(document.activeElement).toBe(current);
    expect(current.getAttribute("aria-pressed")).toBe("true");
    expect(
      within(detail())
        .getByLabelText(fr.tasks.detail.notes)
        .hasAttribute("data-collapsed"),
    ).toBe(false);

    fireEvent.click(layoutChoice("Nouveau"));

    expect(detail()).toBe(before);
    expect(
      within(detail())
        .getByLabelText(fr.tasks.detail.notes)
        .getAttribute("data-collapsed"),
    ).toBe("false");
  });

  it("garde le choix du sélecteur Détail d'une carte à l'autre", async () => {
    renderDemo();
    await openCard(DEMO_PREP);
    fireEvent.click(layoutChoice("Actuel"));

    await closeDetail();
    await openCard(PLUMBER);

    expect(layoutChoice("Actuel").getAttribute("aria-pressed")).toBe("true");
  });

  it("sélecteur Détail en anglais", async () => {
    renderDemo("en");

    await openCard(DEMO_PREP);

    const group = within(
      screen.getByRole("dialog", { name: en.tasks.detail.label }),
    ).getByRole("group", { name: "Detail" });
    expect(within(group).getByRole("button", { name: "New" })).toBeTruthy();
    expect(within(group).getByRole("button", { name: "Current" })).toBeTruthy();
  });
});
