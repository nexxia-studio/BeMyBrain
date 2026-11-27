import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import type {
  BoardColumn as ShownColumn,
  BoardMove,
  CardState,
} from "@/components/kanban/SortableBoard";
import { getUserTimeZone } from "@/modules/core/time-zone";
import type { BoardColumn, Task } from "@/modules/tasks/queries";
import { statusCategories, type StatusCategory } from "@/modules/tasks/sides";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";
import {
  CaughtBoundary,
  expiredSessionRedirect,
} from "../../../tests/factories/next-control";

type BoardProps = {
  columns: readonly ShownColumn<Task>[];
  renderCard: (item: Task, state: CardState) => ReactNode;
  getItemLabel: (item: Task) => string;
  onMove: (move: BoardMove) => void;
  onOpen?: (id: string) => void;
  onCollapsedChange?: (columnId: string, collapsed: boolean) => void;
};

// Double du tableau : le glisser lui-même est couvert par SortableBoard.test.tsx. Ici, chaque colonne rend son
// total, ses cartes et son pied ; `boardProps.current` donne les dernières props, pour déposer par `onMove`.
const boardProps = vi.hoisted(() => ({ current: null as BoardProps | null }));
const animate = vi.hoisted(() => vi.fn());
const reducedMotion = vi.hoisted(() => ({ current: false }));
const runAppAction = vi.hoisted(() => vi.fn());
const setBoardOption = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@/components/kanban/SortableBoard", () => ({
  SortableBoard: (props: BoardProps) => {
    boardProps.current = props;
    return props.columns.map((column) => (
      <section
        key={column.id}
        data-column={column.id}
        data-total={column.total}
        data-collapsed={column.collapsed ? "" : undefined}
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
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));
vi.mock("@/lib/preferences-actions", () => ({ setBoardOption }));
vi.mock("@/lib/settle-action", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settle-action")>();
  return { ...actual, settleAction: vi.fn(actual.settleAction) };
});
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

import { settleAction } from "@/lib/settle-action";

import { TaskBoard } from "./TaskBoard";

const TODAY = "2026-11-26";
const SAVED = { ok: true, result: null };
const NO_SEE_ALL = {
  completed: { expanded: false, href: "/tasks?done=all" },
  canceled: { expanded: false, href: "/tasks?canceled=all" },
};

type Tasks = Partial<Record<StatusCategory, Task[]>>;
type Totals = Partial<Record<StatusCategory, number>>;

/** Colonnes telles que le serveur les rend : `total` réel, `truncated` quand il dépasse les cartes lues. */
function serverColumns(tasks: Tasks, totals: Totals = {}): BoardColumn[] {
  return statusCategories.map((category) => {
    const cards = (tasks[category] ?? []).map((task) => ({
      ...task,
      statusCategory: category,
    }));
    const total = totals[category] ?? cards.length;
    return {
      category,
      tasks: cards,
      total,
      truncated: total > cards.length,
    };
  });
}

type Props = Partial<React.ComponentProps<typeof TaskBoard>> & {
  columns: BoardColumn[];
};

function board(props: Props, locale: "fr" | "en" = "fr") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone={getUserTimeZone()}
    >
      <TaskBoard
        today={TODAY}
        showContext={false}
        listQuery=""
        canceledOpen={false}
        seeAll={NO_SEE_ALL}
        scopeKey="private"
        {...props}
      />
    </NextIntlClientProvider>
  );
}

function idsIn(category: StatusCategory) {
  return [
    ...document.querySelectorAll(
      `[data-column="${category}"] [data-task-card]`,
    ),
  ].map((card) => card.getAttribute("data-task-card"));
}

function totalOf(category: StatusCategory) {
  return document
    .querySelector(`[data-column="${category}"]`)!
    .getAttribute("data-total");
}

async function drop(move: BoardMove) {
  await act(async () => boardProps.current!.onMove(move));
}

/** Laisse passer les promesses en cours (enregistrement résolu, file, rendu). */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const bubble = () => screen.queryByText("Déplacement non enregistré.");

// jsdom ne calcule aucune géométrie : chaque colonne est décalée de 300 px, chaque carte de 60 px.
function fakeRect(this: Element): DOMRect {
  const column = this.closest("[data-column]");
  const columns = [...document.querySelectorAll("[data-column]")];
  const cards = column ? [...column.querySelectorAll("[data-task-card]")] : [];
  const left = columns.indexOf(column!) * 300;
  const top = cards.indexOf(this) * 60;
  return { left, top, x: left, y: top, width: 260, height: 50 } as DOMRect;
}

// Trois cartes « À faire », deux « En cours », une terminée : le tableau de la plupart des tests.
function fixture() {
  const a = buildTask({ title: "Rappeler le plombier" });
  const b = buildTask({ title: "Payer la crèche" });
  const c = buildTask({ title: "Réserver le train" });
  const d = buildTask({ title: "Relancer le devis" });
  const e = buildTask({ title: "Préparer la démo" });
  const done = buildTask({ title: "Déclarer la TVA" });
  const tasks: Tasks = {
    unstarted: [a, b, c],
    started: [d, e],
    completed: [done],
  };
  return { a, b, c, d, e, done, tasks };
}

// Sortie de la bulle jouée instantanément ; le retour de la carte passe par `animate`, remplacé plus haut.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

beforeEach(() => {
  reducedMotion.current = false;
  runAppAction.mockResolvedValue(SAVED);
  setBoardOption.mockResolvedValue(undefined);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    fakeRect,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("tableau des tâches : colonnes et cartes", () => {
  it("affiche les cinq colonnes dans l'ordre des statuts, avec le total du serveur", () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const { tasks } = fixture();

    render(
      board({
        columns: serverColumns(
          { ...tasks, completed: twenty },
          { completed: 34 },
        ),
      }),
    );

    expect(boardProps.current!.columns.map((column) => column.label)).toEqual([
      "À planifier",
      "À faire",
      "En cours",
      "Terminée",
      "Annulée",
    ]);
    expect(statusCategories.map(totalOf)).toEqual(["0", "3", "2", "34", "0"]);
    expect(idsIn("completed")).toHaveLength(20);
  });

  it("une sous-tâche est une carte, avec le titre de sa parente en légende", () => {
    const subtask = buildTask({
      title: "Comparer les devis",
      parentId: "00000000-0000-4000-8000-00000000aaaa",
      parentTitle: "Refaire la salle de bain",
    });

    render(board({ columns: serverColumns({ started: [subtask] }) }));

    const card = document.querySelector(`[data-task-card="${subtask.id}"]`)!;
    expect(card.textContent).toContain("Comparer les devis");
    expect(card.textContent).toContain("Refaire la salle de bain");
  });

  it("nomme une carte par le titre de sa tâche, pour les annonces du lecteur d'écran", () => {
    const { a, tasks } = fixture();

    render(board({ columns: serverColumns(tasks) }));

    expect(boardProps.current!.getItemLabel(a)).toBe("Rappeler le plombier");
  });

  it("pastille d'espace seulement quand la page le demande (même règle que la liste)", () => {
    const task = buildTask({ contextName: "Trustup", contextColor: "warm" });
    const columns = serverColumns({ unstarted: [task] });

    const view = render(board({ columns, showContext: false }));
    expect(screen.queryByText("Trustup")).toBeNull();

    view.rerender(board({ columns, showContext: true }));
    expect(screen.getByText("Trustup")).toBeTruthy();
  });

  it("libellés des colonnes et bulle d'échec en anglais", async () => {
    const { a, d, tasks } = fixture();
    runAppAction.mockResolvedValue({ ok: false });
    render(board({ columns: serverColumns(tasks) }, "en"));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });
    await settle();

    expect(boardProps.current!.columns.map((column) => column.label)).toEqual([
      "To plan",
      "To do",
      "In progress",
      "Done",
      "Canceled",
    ]);
    expect(screen.getByText("Move not saved.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

describe("tableau des tâches : déplacement", () => {
  it("un dépôt appelle tasks.move avec la tâche, la colonne et ses voisines exactes", async () => {
    const { a, d, e, tasks } = fixture();
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: e.id,
    });

    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);
    expect(runAppAction).toHaveBeenCalledExactlyOnceWith("tasks.move", {
      taskId: a.id,
      statusCategory: "started",
      beforeId: d.id,
      afterId: e.id,
    });
  });

  it("en tête de colonne : seule la voisine du dessous est envoyée", async () => {
    const { a, d, tasks } = fixture();
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: null,
      afterId: d.id,
    });

    expect(runAppAction).toHaveBeenCalledExactlyOnceWith("tasks.move", {
      taskId: a.id,
      statusCategory: "started",
      afterId: d.id,
    });
  });

  it("un dépôt dans Terminée part sans voisines et pose la carte en tête, comme le serveur", async () => {
    const { a, done, tasks } = fixture();
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "completed",
      beforeId: done.id,
      afterId: null,
    });

    expect(idsIn("completed")).toEqual([a.id, done.id]);
    expect(runAppAction).toHaveBeenCalledExactlyOnceWith("tasks.move", {
      taskId: a.id,
      statusCategory: "completed",
    });
  });

  it("un dépôt dans sa propre colonne Terminée ou Annulée n'enregistre rien : la carte garde sa place, sans message", async () => {
    const first = buildTask();
    const second = buildTask();
    const gone = buildTask();
    const other = buildTask();
    render(
      board({
        columns: serverColumns({
          completed: [first, second],
          canceled: [gone, other],
        }),
        canceledOpen: true,
      }),
    );

    await drop({
      id: first.id,
      toColumn: "completed",
      beforeId: second.id,
      afterId: null,
    });
    await drop({
      id: other.id,
      toColumn: "canceled",
      beforeId: null,
      afterId: gone.id,
    });
    await settle();

    expect(runAppAction).not.toHaveBeenCalled();
    expect(idsIn("completed")).toEqual([first.id, second.id]);
    expect(idsIn("canceled")).toEqual([gone.id, other.id]);
    expect(bubble()).toBeNull();
    expect(document.querySelector("[aria-busy]")!.ariaBusy).toBe("false");
  });

  it("une carte déposée dans Terminée prend l'allure d'une carte fermée, sans « Bloquée »", async () => {
    const blocked = buildTask({ title: "Signer le bail", blocked: true });
    render(board({ columns: serverColumns({ unstarted: [blocked] }) }));
    expect(screen.getByText("Bloquée")).toBeTruthy();

    await drop({
      id: blocked.id,
      toColumn: "completed",
      beforeId: null,
      afterId: null,
    });

    expect(screen.queryByText("Bloquée")).toBeNull();
    expect(
      screen
        .getByText("Signer le bail")
        .classList.contains("text-muted-foreground"),
    ).toBe(true);
  });

  it("deux dépôts rapides partent l'un après l'autre, dans l'ordre", async () => {
    const { a, b, d, tasks } = fixture();
    const first = deferred<typeof SAVED>();
    runAppAction.mockReturnValueOnce(first.promise);
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: null,
      afterId: d.id,
    });
    await drop({
      id: b.id,
      toColumn: "backlog",
      beforeId: null,
      afterId: null,
    });

    expect(runAppAction).toHaveBeenCalledTimes(1);
    expect(idsIn("started")[0]).toBe(a.id);
    expect(idsIn("backlog")).toEqual([b.id]);

    first.resolve(SAVED);
    await settle();

    expect(runAppAction).toHaveBeenCalledTimes(2);
    expect(runAppAction.mock.calls[1]).toEqual([
      "tasks.move",
      { taskId: b.id, statusCategory: "backlog" },
    ]);
  });

  it("marque le tableau occupé tant qu'un dépôt n'est pas enregistré", async () => {
    const { a, d, tasks } = fixture();
    const saving = deferred<typeof SAVED>();
    runAppAction.mockReturnValueOnce(saving.promise);
    render(board({ columns: serverColumns(tasks) }));
    const busy = () => document.querySelector("[aria-busy]")!.ariaBusy;
    expect(busy()).toBe("false");

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });
    expect(busy()).toBe("true");

    saving.resolve(SAVED);
    await settle();
    expect(busy()).toBe("false");
  });

  it("garde justes les compteurs des colonnes pendant l'attente", async () => {
    const { a, d, tasks } = fixture();
    runAppAction.mockReturnValueOnce(deferred().promise);
    render(
      board({ columns: serverColumns(tasks, { unstarted: 240, started: 2 }) }),
    );

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });

    expect(totalOf("unstarted")).toBe("239");
    expect(totalOf("started")).toBe("3");
  });
});

describe("tableau des tâches : rendu serveur et dépôts", () => {
  it("la carte ne saute pas quand le tableau du serveur arrive avant puis après la résolution", async () => {
    const { a, b, c, d, e, done, tasks } = fixture();
    const saving = deferred<typeof SAVED>();
    runAppAction.mockReturnValueOnce(saving.promise);
    const view = render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: e.id,
    });

    // Avant la résolution : un tableau du serveur qui ne connaît pas encore le dépôt (une carte créée ailleurs).
    const created = buildTask();
    view.rerender(
      board({
        columns: serverColumns({ ...tasks, unstarted: [created, a, b, c] }),
      }),
    );
    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);
    expect(idsIn("unstarted")).toEqual([created.id, b.id, c.id]);

    saving.resolve(SAVED);
    await settle();
    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);

    // Après la résolution : le tableau rafraîchi par l'action, qui fait foi.
    view.rerender(
      board({
        columns: serverColumns({
          unstarted: [created, b, c],
          started: [d, a, e],
          completed: [done],
        }),
      }),
    );
    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);
    expect(idsIn("unstarted")).toEqual([created.id, b.id, c.id]);
  });

  it("option basculée pendant un enregistrement : la carte ne recule pas", async () => {
    const subtask = buildTask({
      parentId: "00000000-0000-4000-8000-00000000bbbb",
      parentTitle: "Parente",
    });
    const { a, b, c, d, e, done, tasks } = fixture();
    const saving = deferred<typeof SAVED>();
    runAppAction.mockReturnValueOnce(saving.promise);
    const withSubtask = { ...tasks, started: [d, e, subtask] };
    const view = render(
      board({ columns: serverColumns(withSubtask), scopeKey: "private:1" }),
    );

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: e.id,
    });

    // « Sous-tâches » éteint : le serveur rend le tableau sans la sous-tâche, sans connaître le dépôt.
    view.rerender(
      board({ columns: serverColumns(tasks), scopeKey: "private:0" }),
    );
    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);
    expect(idsIn("unstarted")).toEqual([b.id, c.id]);

    saving.resolve(SAVED);
    await settle();
    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);

    view.rerender(
      board({
        columns: serverColumns({
          unstarted: [b, c],
          started: [d, a, e],
          completed: [done],
        }),
        scopeKey: "private:0",
      }),
    );
    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);
  });

  it("après le tableau du serveur, la carte est là où le serveur l'a mise", async () => {
    const { a, b, c, d, e, done, tasks } = fixture();
    const view = render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: e.id,
    });
    await settle();
    // Voisine périmée : le serveur a placé la carte en tête.
    view.rerender(
      board({
        columns: serverColumns({
          unstarted: [b, c],
          started: [a, d, e],
          completed: [done],
        }),
      }),
    );

    expect(idsIn("started")).toEqual([a.id, d.id, e.id]);
  });
});

describe("tableau des tâches : échec d'un enregistrement", () => {
  it("refus du serveur : la carte revient, animée depuis l'endroit du dépôt, et Réessayer rejoue le dépôt", async () => {
    const { a, b, c, d, e, tasks } = fixture();
    runAppAction.mockResolvedValueOnce({ ok: false, code: "not_found" });
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: e.id,
    });
    await settle();

    expect(idsIn("unstarted")).toEqual([a.id, b.id, c.id]);
    expect(idsIn("started")).toEqual([d.id, e.id]);
    // Lâchée 2e de « En cours » (colonne 3), revenue en tête de « À faire » (colonne 2).
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0][0]).toBe(
      document.querySelector(`[data-task-card="${a.id}"]`),
    );
    expect(animate.mock.calls[0][1]).toEqual({ x: [300, 0], y: [60, 0] });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Déplacement non enregistré.");

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await settle();

    expect(runAppAction).toHaveBeenCalledTimes(2);
    expect(runAppAction.mock.calls[1]).toEqual(runAppAction.mock.calls[0]);
    expect(idsIn("started")).toEqual([d.id, a.id, e.id]);
    expect(bubble()).toBeNull();
  });

  it("mouvement réduit : la carte revient sans animation", async () => {
    const { a, d, tasks } = fixture();
    reducedMotion.current = true;
    runAppAction.mockResolvedValueOnce({ ok: false });
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });
    await settle();

    expect(idsIn("unstarted")[0]).toBe(a.id);
    expect(animate).not.toHaveBeenCalled();
    expect(bubble()).toBeTruthy();
  });

  it("le bouton Réessayer offre une zone d'au moins 44 px", async () => {
    const { a, d, tasks } = fixture();
    runAppAction.mockResolvedValueOnce({ ok: false });
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });
    await settle();

    expect(
      screen
        .getByRole("button", { name: "Réessayer" })
        .classList.contains("min-h-11"),
    ).toBe(true);
  });

  it("panne de l'action (réseau) : échec affiché, et la file enregistre le dépôt suivant", async () => {
    const { a, b, d, tasks } = fixture();
    runAppAction.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });
    await settle();

    expect(idsIn("unstarted")[0]).toBe(a.id);
    expect(bubble()).toBeTruthy();

    await drop({
      id: b.id,
      toColumn: "backlog",
      beforeId: null,
      afterId: null,
    });
    await settle();

    expect(runAppAction).toHaveBeenCalledTimes(2);
    expect(idsIn("backlog")).toEqual([b.id]);
    expect(bubble()).toBeNull();
  });

  it("panne remise au tableau par la file : journalisée sous un libellé fixe, sans donnée de la tâche, file en vie", async () => {
    const { a, b, d, tasks } = fixture();
    const failure = new Error("panne");
    vi.mocked(settleAction).mockRejectedValueOnce(failure);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(board({ columns: serverColumns(tasks) }));

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });
    await settle();

    expect(logged).toHaveBeenCalledExactlyOnceWith(
      "[tasks] déplacement en échec",
      failure,
    );
    // Tout ce qui est journalisé : le libellé fixe et l'erreur reçue, rien de la tâche.
    expect(logged.mock.calls.flat()).toEqual([
      "[tasks] déplacement en échec",
      failure,
    ]);
    expect(idsIn("unstarted")[0]).toBe(a.id);
    expect(bubble()).toBeTruthy();

    await drop({
      id: b.id,
      toColumn: "backlog",
      beforeId: null,
      afterId: null,
    });
    await settle();

    expect(idsIn("backlog")).toEqual([b.id]);
  });

  it("session expirée : le renvoi vers /login est rendu à Next, sans bulle d'échec ni journal", async () => {
    const { a, d, tasks } = fixture();
    const redirect = expiredSessionRedirect();
    runAppAction.mockRejectedValueOnce(redirect);
    const caught = vi.fn();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CaughtBoundary onError={caught}>
        {board({ columns: serverColumns(tasks) })}
      </CaughtBoundary>,
    );

    await drop({
      id: a.id,
      toColumn: "started",
      beforeId: d.id,
      afterId: null,
    });
    await settle();

    // Relancée au rendu : la frontière (RedirectBoundary de Next) la reçoit et navigue.
    expect(caught).toHaveBeenCalledExactlyOnceWith(redirect);
    expect(bubble()).toBeNull();
    expect(logged).not.toHaveBeenCalledWith(
      "[tasks] déplacement en échec",
      expect.anything(),
    );
    expect(runAppAction).toHaveBeenCalledTimes(1);
  });
});

describe("tableau des tâches : Terminée et Annulée", () => {
  it("« Tout voir (n) » seulement quand le total dépasse 20, vers l'adresse donnée par la page", () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const few = [buildTask(), buildTask()];

    render(
      board({
        columns: serverColumns(
          { completed: twenty, canceled: few },
          { completed: 34 },
        ),
        canceledOpen: true,
      }),
    );

    const link = screen.getByRole("link", { name: "Tout voir (34)" });
    expect(link.getAttribute("href")).toBe("/tasks?done=all");
    expect(link.classList.contains("min-h-11")).toBe(true);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText(/premières cartes/)).toBeNull();
  });

  it("tout affiché : « Voir les 20 plus récentes » ramène à la limite", () => {
    const all = Array.from({ length: 34 }, () => buildTask());

    render(
      board({
        columns: serverColumns({ completed: all }),
        seeAll: {
          ...NO_SEE_ALL,
          completed: { expanded: true, href: "/tasks" },
        },
      }),
    );

    expect(idsIn("completed")).toHaveLength(34);
    expect(
      screen
        .getByRole("link", { name: "Voir les 20 plus récentes" })
        .getAttribute("href"),
    ).toBe("/tasks");
  });

  it("colonne au plafond : le dit sous ses cartes (colonne ouverte, ou « Tout voir » dépassé)", () => {
    const { tasks } = fixture();

    render(
      board({
        columns: serverColumns(
          { ...tasks, completed: [buildTask()] },
          { unstarted: 240, completed: 260 },
        ),
        seeAll: {
          ...NO_SEE_ALL,
          completed: { expanded: true, href: "/tasks" },
        },
      }),
    );

    const capped = screen.getAllByText(
      "Seules les 200 premières cartes sont affichées.",
    );
    expect(capped.map((text) => text.closest("[data-column]"))).toEqual([
      document.querySelector('[data-column="unstarted"]'),
      document.querySelector('[data-column="completed"]'),
    ]);
  });

  it("une carte déposée dans Terminée reste visible au-delà des 20 cartes", async () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const { a, tasks } = fixture();
    render(
      board({
        columns: serverColumns(
          { ...tasks, completed: twenty },
          { completed: 34 },
        ),
      }),
    );

    await drop({
      id: a.id,
      toColumn: "completed",
      beforeId: twenty[19].id,
      afterId: null,
    });
    await settle();

    expect(idsIn("completed")).toHaveLength(21);
    expect(idsIn("completed")[0]).toBe(a.id);
    expect(totalOf("completed")).toBe("35");
  });

  it("une carte terminée déposée sur Annulée reste visible quand sa date la range au-delà des 20 du serveur", async () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const old = buildTask({ title: "Vieille tâche" });
    const before = { completed: [old], canceled: twenty };
    const view = render(
      board({
        columns: serverColumns(before, { canceled: 30 }),
        canceledOpen: true,
      }),
    );

    await drop({
      id: old.id,
      toColumn: "canceled",
      beforeId: null,
      afterId: null,
    });
    await settle();
    // Le serveur garde sa date de clôture : elle n'est pas dans les 20 plus récentes d'Annulée.
    view.rerender(
      board({
        columns: serverColumns({ canceled: twenty }, { canceled: 31 }),
        canceledOpen: true,
      }),
    );

    expect(idsIn("canceled")).toEqual([...twenty.map((t) => t.id), old.id]);
    expect(totalOf("canceled")).toBe("31");
    expect(idsIn("completed")).toEqual([]);
  });

  it("cette carte gardée n'est plus montrée une fois ouverte, ni dans un autre périmètre", async () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const old = buildTask();
    const other = buildTask();
    const after = serverColumns({ canceled: twenty }, { canceled: 32 });
    const view = render(
      board({
        columns: serverColumns(
          { completed: [old, other], canceled: twenty },
          { canceled: 30 },
        ),
        canceledOpen: true,
      }),
    );
    for (const task of [old, other]) {
      await drop({
        id: task.id,
        toColumn: "canceled",
        beforeId: null,
        afterId: null,
      });
    }
    await settle();
    view.rerender(board({ columns: after, canceledOpen: true }));
    expect(idsIn("canceled")).toHaveLength(22);

    act(() => boardProps.current!.onOpen!(old.id));
    expect(idsIn("canceled")).toEqual([...twenty.map((t) => t.id), other.id]);

    view.rerender(
      board({ columns: after, canceledOpen: true, scopeKey: "pro" }),
    );
    expect(idsIn("canceled")).toHaveLength(20);
  });

  it("dépôt dans Terminée en échec, puis nouveau dépôt à la main : tasks.move rappelé", async () => {
    const { a, done, tasks } = fixture();
    runAppAction.mockResolvedValueOnce({ ok: false });
    render(board({ columns: serverColumns(tasks) }));
    const toDone: BoardMove = {
      id: a.id,
      toColumn: "completed",
      beforeId: null,
      afterId: done.id,
    };

    await drop(toDone);
    await settle();
    expect(idsIn("unstarted")[0]).toBe(a.id);

    await drop({ ...toDone });
    await settle();

    expect(runAppAction).toHaveBeenCalledTimes(2);
    expect(idsIn("completed")).toEqual([a.id, done.id]);
    expect(bubble()).toBeNull();
  });

  it("dépôt en échec vers une colonne fermée : la carte n'est pas gardée de mémoire", async () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const old = buildTask();
    runAppAction.mockResolvedValueOnce({ ok: false });
    const view = render(
      board({
        columns: serverColumns(
          { completed: [old], canceled: twenty },
          { canceled: 30 },
        ),
        canceledOpen: true,
      }),
    );

    await drop({
      id: old.id,
      toColumn: "canceled",
      beforeId: null,
      afterId: null,
    });
    await settle();
    // Plus tard, la carte quitte le tableau par un autre canal (corbeille) : aucune carte fantôme.
    view.rerender(
      board({
        columns: serverColumns({ canceled: twenty }, { canceled: 30 }),
        canceledOpen: true,
      }),
    );

    expect(idsIn("canceled")).toEqual(twenty.map((t) => t.id));
  });

  it("Réessayer après un échec vers Annulée : enregistré, et la carte est de nouveau gardée au-delà des 20", async () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const old = buildTask();
    runAppAction.mockResolvedValueOnce({ ok: false });
    const view = render(
      board({
        columns: serverColumns(
          { completed: [old], canceled: twenty },
          { canceled: 30 },
        ),
        canceledOpen: true,
      }),
    );
    await drop({
      id: old.id,
      toColumn: "canceled",
      beforeId: null,
      afterId: null,
    });
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await settle();
    view.rerender(
      board({
        columns: serverColumns({ canceled: twenty }, { canceled: 31 }),
        canceledOpen: true,
      }),
    );

    expect(runAppAction).toHaveBeenCalledTimes(2);
    expect(idsIn("canceled")).toEqual([...twenty.map((t) => t.id), old.id]);
  });

  it("une carte gardée de mémoire ne se déplace pas : elle reste affichée à sa place, rien n'est enregistré", async () => {
    const twenty = Array.from({ length: 20 }, () => buildTask());
    const old = buildTask();
    const open = buildTask();
    const view = render(
      board({
        columns: serverColumns(
          { unstarted: [open], completed: [old], canceled: twenty },
          { canceled: 30 },
        ),
        canceledOpen: true,
      }),
    );
    await drop({
      id: old.id,
      toColumn: "canceled",
      beforeId: null,
      afterId: null,
    });
    await settle();
    view.rerender(
      board({
        columns: serverColumns(
          { unstarted: [open], canceled: twenty },
          { canceled: 31 },
        ),
        canceledOpen: true,
      }),
    );
    runAppAction.mockClear();

    await drop({
      id: old.id,
      toColumn: "unstarted",
      beforeId: open.id,
      afterId: null,
    });
    await drop({
      id: old.id,
      toColumn: "completed",
      beforeId: null,
      afterId: null,
    });
    await drop({
      id: old.id,
      toColumn: "canceled",
      beforeId: null,
      afterId: twenty[0].id,
    });
    await settle();

    expect(runAppAction).not.toHaveBeenCalled();
    expect(idsIn("canceled")).toEqual([...twenty.map((t) => t.id), old.id]);
    expect(idsIn("unstarted")).toEqual([open.id]);
    expect(totalOf("canceled")).toBe("31");
    expect(bubble()).toBeNull();
  });

  it("Annulée : repliable, repliée ou dépliée selon la préférence reçue ; les autres colonnes ne le sont pas", () => {
    const columns = serverColumns({ canceled: [buildTask()] });
    const shown = () =>
      boardProps.current!.columns.map((column) => [
        column.collapsible ?? false,
        column.collapsed ?? false,
      ]);

    const view = render(board({ columns, canceledOpen: false }));
    expect(shown()).toEqual([
      [false, false],
      [false, false],
      [false, false],
      [false, false],
      [true, true],
    ]);

    view.rerender(board({ columns, canceledOpen: true }));
    expect(shown()[4]).toEqual([true, false]);
  });

  it("déplier Annulée : dépliée aussitôt, et la préférence est enregistrée", async () => {
    const saving = deferred<void>();
    setBoardOption.mockReturnValueOnce(saving.promise);
    const gone = buildTask();
    render(
      board({
        columns: serverColumns({ canceled: [gone] }),
        canceledOpen: false,
      }),
    );
    expect(idsIn("canceled")).toEqual([]);

    await act(async () =>
      boardProps.current!.onCollapsedChange!("canceled", false),
    );

    // Avant la réponse du serveur : affichage optimiste.
    expect(idsIn("canceled")).toEqual([gone.id]);
    expect(setBoardOption).toHaveBeenCalledExactlyOnceWith(
      "canceledOpen",
      true,
    );
    await act(async () => saving.resolve());
  });

  it("préférence d'Annulée non enregistrée : retour à l'état enregistré, avec un message", async () => {
    setBoardOption.mockRejectedValueOnce(new Error("panne"));
    render(
      board({
        columns: serverColumns({ canceled: [buildTask()] }),
        canceledOpen: false,
      }),
    );

    await act(async () =>
      boardProps.current!.onCollapsedChange!("canceled", false),
    );
    await settle();

    expect(idsIn("canceled")).toEqual([]);
    expect(screen.getByRole("status").textContent).toBe(
      fr.shell.preferenceError,
    );
  });
});

describe("tableau des tâches : ouverture du détail", () => {
  it("ouvrir une carte mène au détail de la tâche, requête de la page gardée, sans défilement", () => {
    const { a, tasks } = fixture();
    render(board({ columns: serverColumns(tasks), listQuery: "?done=all" }));

    act(() => boardProps.current!.onOpen!(a.id));

    expect(push).toHaveBeenCalledExactlyOnceWith(`/tasks/${a.id}?done=all`, {
      scroll: false,
    });
  });
});

describe("tableau des tâches : tableau sans tâche", () => {
  function withQuickAdd(open: () => void, props: Props, locale?: "fr" | "en") {
    return (
      <OpenQuickAddContext value={open}>
        {board(props, locale)}
      </OpenQuickAddContext>
    );
  }

  it("sans aucune tâche, dit une phrase en français et invite à ajouter, l'invitation ouvre l'ajout rapide", () => {
    const open = vi.fn();
    render(withQuickAdd(open, { columns: serverColumns({}) }));

    expect(screen.getByText(fr.tasks.board.empty)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: fr.tasks.board.add }),
    );
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("sans aucune tâche, dit la même chose en anglais", () => {
    render(withQuickAdd(vi.fn(), { columns: serverColumns({}) }, "en"));

    expect(screen.getByText(en.tasks.board.empty)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: en.tasks.board.add }),
    ).toBeTruthy();
  });

  it("avec une tâche, même seulement terminée, rien n'est ajouté", () => {
    const { tasks } = fixture();
    render(withQuickAdd(vi.fn(), { columns: serverColumns(tasks) }));
    expect(screen.queryByText(fr.tasks.board.empty)).toBeNull();

    cleanup();
    render(
      withQuickAdd(vi.fn(), {
        columns: serverColumns({ completed: [buildTask({ title: "Fait" })] }),
      }),
    );
    expect(screen.queryByText(fr.tasks.board.empty)).toBeNull();
  });
});
