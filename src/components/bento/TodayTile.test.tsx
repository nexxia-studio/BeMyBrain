import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";
import { todayTileItems } from "@/modules/tasks/view";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

import { TODAY_TILE_CLASSES } from "./tile-sizes";
import { TodayHead } from "./TodayHead";
import { TodayTile } from "./TodayTile";

const TODAY = "2026-11-19";

type TodayTileProps = Parameters<typeof TodayTile>[0];

function renderTile(props: Partial<TodayTileProps> = {}) {
  return render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <TodayTile
        hasSpaces
        today={TODAY}
        due={todayTileItems([], TODAY)}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

const tile = () => screen.getByTestId("tile-today");
const dueOn = (count: number) =>
  todayTileItems(
    Array.from({ length: count }, (_, i) =>
      buildTask({ title: `Tâche ${i}`, side: "private", dueDate: TODAY }),
    ),
    TODAY,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T09:00:00+01:00"));
});

afterEach(() => {
  vi.useRealTimers();
  runAppAction.mockReset();
});

describe("tuile « Aujourd'hui »", () => {
  it("compteurs en retard / aujourd'hui, 3 lignes, côté en légende, lien vers la to-do", () => {
    const due = todayTileItems(
      [
        buildTask({
          title: "Payer la crèche",
          side: "private",
          dueDate: "2026-11-18",
        }),
        buildTask({
          title: "Relancer le devis",
          side: "pro",
          dueDate: TODAY,
          dueTime: "14:00",
        }),
        buildTask({
          title: "Appeler le garage",
          side: "private",
          dueDate: TODAY,
        }),
        buildTask({ title: "Quatrième", side: "pro", dueDate: TODAY }),
      ],
      TODAY,
    );

    renderTile({ due });

    expect(within(tile()).getByTestId("today-overdue-count").textContent).toBe(
      "1",
    );
    expect(within(tile()).getByTestId("today-due-count").textContent).toBe("3");
    const rows = within(
      within(tile()).getByRole("list", { name: "Tâches du jour" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("Payer la crèche");
    expect(rows[0].textContent).toContain("Privé");
    expect(rows[1].textContent).toContain("Relancer le devis");
    expect(rows[1].textContent).toContain("Pro");
    expect(rows[1].textContent).toContain("14:00");
    expect(tile().textContent).not.toContain("Quatrième");
    const seeAll = within(tile()).getByRole("link", { name: "Voir la to-do" });
    expect(seeAll.getAttribute("href")).toBe("/tasks");
  });

  it("une ligne mène au détail ; une sous-tâche porte le titre de sa parente en légende", () => {
    const task = buildTask({
      title: "Réserver la salle",
      parentId: "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
      parentTitle: "Préparer le salon",
      dueDate: TODAY,
    });

    renderTile({ due: todayTileItems([task], TODAY) });

    const link = within(tile()).getByRole("link", {
      name: /Réserver la salle/,
    });
    expect(link.getAttribute("href")).toBe(`/tasks/${task.id}`);
    expect(within(link).getByText("Préparer le salon")).toBeTruthy();
  });

  it("cocher une ligne la termine : case désactivée pendant l'appel, erreur dans la ligne", async () => {
    let resolve!: (value: unknown) => void;
    runAppAction.mockReturnValue(new Promise((r) => (resolve = r)));
    const task = buildTask({ title: "Payer la crèche", dueDate: TODAY });
    renderTile({ due: todayTileItems([task], TODAY) });

    const box = within(tile()).getByRole("checkbox", {
      name: "Terminer « Payer la crèche »",
    }) as HTMLInputElement;
    fireEvent.click(box);

    await waitFor(() => expect(box.disabled).toBe(true));
    expect(box.checked).toBe(false);
    expect(runAppAction).toHaveBeenCalledWith("tasks.complete", {
      taskId: task.id,
    });

    await act(async () => resolve({ ok: false, code: "not_found" }));

    expect(
      within(tile()).getByText("Tâche introuvable ou à la corbeille."),
    ).toBeTruthy();
    expect(box.disabled).toBe(false);
  });

  it("à la hauteur de son contenu : classes de place de tile-sizes.ts, aucune classe de hauteur, rien d'étiré", () => {
    renderTile({ due: dueOn(3) });

    for (const name of TODAY_TILE_CLASSES.split(" ")) {
      expect(tile().classList.contains(name)).toBe(true);
    }
    const classes = [tile(), ...tile().querySelectorAll("*")].flatMap(
      (element) => Array.from(element.classList),
    );
    // `min-h-11` : zone tactile de 44 px des lignes et du lien, pas une hauteur de tuile.
    expect(
      classes.filter(
        (name) => /(^|:)(min-|max-)?h-/.test(name) && name !== "min-h-11",
      ),
    ).toEqual([]);
    expect(classes).not.toContain("justify-between");
  });

  it("étirée par sa rangée : contenu en haut, lien « Voir la to-do » poussé en bas", () => {
    renderTile({ due: dueOn(3) });

    const seeAll = within(tile()).getByRole("link", { name: "Voir la to-do" });
    const body = seeAll.parentElement as HTMLElement;
    expect(seeAll.classList.contains("mt-auto")).toBe(true);
    expect(body.parentElement).toBe(tile());
    expect(body.classList.contains("grow")).toBe(true);
    expect(tile().classList.contains("flex-col")).toBe(true);
  });

  it("porte son identifiant de tuile pour le relevé des hauteurs du givre", () => {
    renderTile();

    expect(tile().dataset.tile).toBe("today");
  });

  it("une ligne de la tuile tient sur une ligne : titre tronqué, légende sans retour à la ligne", () => {
    const title =
      "Renouveler l'assurance de la voiture avant la fin du mois prochain";
    renderTile({
      due: todayTileItems(
        [buildTask({ title, dueDate: TODAY, dueTime: "14:00" })],
        TODAY,
      ),
    });

    const link = within(tile()).getByRole("link", { name: new RegExp(title) });
    const titleSpan = within(link).getByText(title);
    const legend = within(link).getByText("14:00").parentElement;
    expect(titleSpan.classList.contains("truncate")).toBe(true);
    expect(titleSpan.classList.contains("line-clamp-2")).toBe(false);
    expect(legend?.classList.contains("flex-nowrap")).toBe(true);
    expect(legend?.classList.contains("overflow-hidden")).toBe(true);
  });

  it.each([1, 2])(
    "%i tâche(s) sur 3 : aucun état de remplissage sous les lignes",
    (count) => {
      renderTile({ due: dueOn(count) });

      expect(within(tile()).queryByTestId("tile-rest")).toBeNull();
      expect(tile().textContent).not.toContain("Rien d'autre aujourd'hui.");
    },
  );

  it("rien de dû : l'état vide compact, la phrase « rien en retard » en introduction sous la salutation", () => {
    renderTile();

    const greeting = within(tile()).getByRole("heading", {
      name: messages.dashboard.today.greeting,
    });
    expect(greeting.nextElementSibling?.textContent).toBe(
      messages.dashboard.today.introClear,
    );
    expect(within(tile()).queryByTestId("tile-rest")).toBeNull();
  });

  it("l'en-tête (date, salutation, introduction) vient de TodayHead, partagé avec le givre de chargement", () => {
    renderTile();
    const real = tile().firstElementChild?.outerHTML;

    const shared = render(
      <NextIntlClientProvider
        locale="fr"
        messages={messages}
        timeZone={getUserTimeZone()}
      >
        <TodayHead intro={messages.dashboard.today.introClear} />
      </NextIntlClientProvider>,
    ).container.firstElementChild?.outerHTML;

    expect(real).toBe(shared);
  });

  it("cale du givre : TodayHead sans repère de test ni cible d'animation, la vraie tuile les garde", () => {
    renderTile();
    const real = tile().firstElementChild as HTMLElement;

    const strut = render(
      <NextIntlClientProvider
        locale="fr"
        messages={messages}
        timeZone={getUserTimeZone()}
      >
        <TodayHead intro={messages.dashboard.today.introClear} strut />
      </NextIntlClientProvider>,
    ).container.firstElementChild as HTMLElement;

    expect(real.querySelector('[data-testid="today-date"]')).not.toBeNull();
    expect(real.querySelectorAll("[data-signature-item]")).toHaveLength(3);
    expect(strut.querySelector("[data-testid]")).toBeNull();
    expect(strut.querySelector("[data-signature-item]")).toBeNull();
    expect(strut.textContent).toBe(real.textContent);
  });

  it("rien en retard ni aujourd'hui : une phrase le dit, ni compteur ni ligne", () => {
    renderTile();

    expect(tile().textContent).toContain(messages.dashboard.today.introClear);
    expect(within(tile()).queryByTestId("today-overdue-count")).toBeNull();
    expect(within(tile()).queryByRole("list")).toBeNull();
  });

  it("côté sans espace : la tuile le dit", () => {
    renderTile({ hasSpaces: false });

    expect(tile().textContent).toContain(messages.dashboard.today.introNoSpace);
  });

  it("lecture en échec : message d'erreur, la date et la salutation restent", () => {
    renderTile({ due: null });

    expect(within(tile()).getByRole("status").textContent).toBe(
      messages.dashboard.today.error,
    );
    expect(tile().textContent).toContain("jeudi 19 novembre");
    expect(tile().textContent).toContain(messages.dashboard.today.greeting);
    expect(within(tile()).queryByTestId("today-overdue-count")).toBeNull();
  });
});
