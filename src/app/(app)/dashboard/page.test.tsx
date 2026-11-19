import { render, screen, within } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../../messages/fr.json";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const redirectIfRejectedToken = vi.hoisted(() => vi.fn());
const loadSideSpaces = vi.hoisted(() => vi.fn());
const loadCurrentScope = vi.hoisted(() => vi.fn());
const loadDueToday = vi.hoisted(() => vi.fn());
const loadUpcomingTasks = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  requireSessionWithToken,
  redirectIfRejectedToken,
}));
vi.mock("@/lib/context-filter", () => ({ loadSideSpaces, loadCurrentScope }));
vi.mock("@/modules/tasks/load", () => ({ loadDueToday, loadUpcomingTasks }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "dashboard") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

// Moments GSAP : testés à part (src/components/signature/).
vi.mock("next/dynamic", () => ({ default: () => () => null }));

// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son seul titre.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";

import { buildTask } from "../../../../tests/factories/build-task";
import DashboardPage from "./page";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "Atelier Monie",
};
const PERSO = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Perso" };
const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

const PRIVATE_SIDE = {
  side: "private",
  contexts: [PERSO],
  selected: [PERSO.id],
};
const PRO_SIDE = {
  side: "pro",
  contexts: [TRUSTUP, NEXXIA],
  selected: [TRUSTUP.id, NEXXIA.id],
};

async function renderPage() {
  const element = await DashboardPage();
  return render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <OpenQuickAddContext value={vi.fn()}>{element}</OpenQuickAddContext>
    </NextIntlClientProvider>,
  );
}

/** Côté déclaré par chaque tuile de module (la tuile « Aujourd'hui » n'appartient à aucun côté). */
function renderedSides() {
  return screen
    .queryAllByTestId(/^tile-/)
    .map((tile) => tile.dataset.side)
    .filter((side) => side !== undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  // jsdom n'a pas matchMedia (lu par la grille avant la peinture).
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
  }));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T09:00:00+01:00"));
  requireSessionWithToken.mockResolvedValue({
    session: SESSION,
    token: "jeton",
  });
  useSide(PRIVATE_SIDE);
  loadDueToday.mockResolvedValue([]);
  loadUpcomingTasks.mockResolvedValue([]);
});

/** Côté et filtre d'espace courants, comme les rend context-filter (lecture partagée). */
function useSide(spaces: {
  side: string;
  contexts: { id: string; name: string }[];
  selected: string[];
}) {
  loadSideSpaces.mockResolvedValue(spaces);
  const filtered = spaces.contexts.length > 1 && spaces.selected.length === 1;
  loadCurrentScope.mockResolvedValue({
    side: spaces.side,
    contexts: spaces.contexts,
    contextId: filtered ? spaces.selected[0] : null,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tableau de bord", () => {
  it("côté Pro, aucune tuile Privé n'est rendue", async () => {
    useSide(PRO_SIDE);

    await renderPage();

    const sides = renderedSides();
    expect(sides.length).toBeGreaterThan(0);
    expect(sides).not.toContain("private");
    expect(
      screen.queryByText(messages.dashboard.tiles.shopping.title),
    ).toBeNull();
  });

  it("côté Privé, aucune tuile Pro n'est rendue", async () => {
    await renderPage();

    const sides = renderedSides();
    expect(sides.length).toBeGreaterThan(0);
    expect(sides).not.toContain("pro");
  });

  it("la tuile « Aujourd'hui » lit les tâches des deux côtés, au jour de Bruxelles", async () => {
    vi.setSystemTime(new Date("2026-11-19T23:30:00Z"));
    loadDueToday.mockResolvedValue([
      buildTask({
        title: "Payer la crèche",
        side: "private",
        dueDate: "2026-11-20",
      }),
      buildTask({
        title: "Relancer le devis",
        side: "pro",
        dueDate: "2026-11-19",
      }),
    ]);

    await renderPage();

    expect(loadDueToday).toHaveBeenCalledWith(
      "jeton",
      SESSION.workspaceId,
      "2026-11-20",
    );
    const today = screen.getByTestId("tile-today");
    expect(within(today).getByTestId("today-overdue-count").textContent).toBe(
      "1",
    );
    expect(within(today).getByTestId("today-due-count").textContent).toBe("1");
    expect(today.textContent).toContain("Payer la crèche");
    expect(today.textContent).toContain("Relancer le devis");
  });

  it("la tuile To-do lit les 5 prochaines tâches du côté actif et de l'espace filtré", async () => {
    useSide({ ...PRO_SIDE, selected: [NEXXIA.id] });
    loadUpcomingTasks.mockResolvedValue([
      buildTask({ title: "Préparer la démo", side: "pro" }),
    ]);

    await renderPage();

    expect(loadUpcomingTasks).toHaveBeenCalledWith(
      "jeton",
      SESSION.workspaceId,
      {
        side: "pro",
        contextId: NEXXIA.id,
        limit: 5,
      },
    );
    expect(screen.getByTestId("tile-proTodo").textContent).toContain(
      "Préparer la démo",
    );
  });

  it("une tuile qui échoue n'empêche pas le reste du tableau de bord de s'afficher", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    loadDueToday.mockRejectedValue(new Error("panne"));
    loadUpcomingTasks.mockResolvedValue([
      buildTask({ title: "Payer la crèche" }),
    ]);

    await renderPage();

    expect(
      within(screen.getByTestId("tile-today")).getByRole("status").textContent,
    ).toBe(messages.dashboard.today.error);
    expect(screen.getByTestId("tile-privateTodo").textContent).toContain(
      "Payer la crèche",
    );
    expect(screen.getByTestId("tile-health")).toBeTruthy();
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { tile: "today" },
    });
  });

  it("étiquette chaque tuile avec les espaces qu'elle couvre quand le côté en a plusieurs", async () => {
    useSide(PRO_SIDE);

    await renderPage();

    const spaces = within(screen.getByTestId("tile-proTodo")).getByRole(
      "list",
      {
        name: messages.dashboard.tiles.spaces,
      },
    );
    expect(
      within(spaces)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Trustup", "Nexxia"]);
  });

  it("affiche la date du jour selon la langue", async () => {
    await renderPage();

    expect(screen.getByTestId("tile-today").textContent).toContain(
      "jeudi 12 novembre",
    );
  });

  it("chaque tuile vide dit à quoi elle sert", async () => {
    await renderPage();

    expect(
      within(screen.getByTestId("tile-health")).getByText(
        messages.dashboard.tiles.health.body,
      ),
    ).toBeTruthy();
  });

  it("un côté sans espace n'affiche que la tuile « Aujourd'hui », qui le dit", async () => {
    useSide({
      side: "pro",
      contexts: [],
      selected: [],
    });

    await renderPage();

    expect(
      screen.queryAllByTestId(/^tile-/).map((tile) => tile.dataset.testid),
    ).toEqual(["tile-today"]);
    expect(
      screen.getByText(messages.dashboard.today.introNoSpace),
    ).toBeTruthy();
  });

  it("affiche le nom du workspace résolu depuis la session", async () => {
    await renderPage();

    expect(screen.getByTestId("workspace-name").textContent).toBe(
      "Atelier Monie",
    );
  });

  it("titre la page par son en-tête", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: messages.dashboard.title }),
    ).toBeTruthy();
  });

  it("appelle elle-même requireSession (sans compter sur le layout)", async () => {
    requireSessionWithToken.mockRejectedValue(new Error("REDIRECT:/login"));

    const run = DashboardPage();

    await expect(run).rejects.toThrow("REDIRECT:/login");
  });
});
