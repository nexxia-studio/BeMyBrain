// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
  }),
}));

import {
  contextsCookie,
  parseBoardOption,
  parseContextSelection,
  parseSide,
  parseTasksView,
  readBoardOptions,
  serializeContextSelection,
  SIDE_COOKIE,
  TASKS_VIEW_COOKIE,
} from "./preferences";
import { BOARD_OPTION_COOKIES } from "./board-option-cookie";

const TRUSTUP = "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";
const NEXXIA = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const PRO_CONTEXTS = [TRUSTUP, NEXXIA];

describe("préférences d'affichage (cookies)", () => {
  it("nomme le cookie du côté bmb_side", () => {
    expect(SIDE_COOKIE).toBe("bmb_side");
  });

  it("mémorise le filtre d'espace dans un cookie par côté", () => {
    const names = [contextsCookie("private"), contextsCookie("pro")];

    expect(names).toEqual(["bmb_contexts_private", "bmb_contexts_pro"]);
  });

  it("une valeur de cookie inconnue retombe sur Privé", () => {
    const side = parseSide("perso");

    expect(side).toBe("private");
  });

  it("un cookie absent retombe sur Privé", () => {
    expect(parseSide(undefined)).toBe("private");
  });

  it("lit le côté Pro enregistré", () => {
    expect(parseSide("pro")).toBe("pro");
  });

  it("garde le contexte choisi quand il appartient au workspace", () => {
    const selection = parseContextSelection(NEXXIA, PRO_CONTEXTS);

    expect(selection).toEqual([NEXXIA]);
  });

  it("sans cookie, sélectionne tous les contextes du côté", () => {
    expect(parseContextSelection(undefined, PRO_CONTEXTS)).toEqual(
      PRO_CONTEXTS,
    );
  });

  it("ignore un identifiant étranger au workspace ou mal formé et retombe sur tous", () => {
    const foreign = "11111111-2222-4333-8444-555555555555";

    const selection = parseContextSelection(
      `${foreign},pas-un-uuid`,
      PRO_CONTEXTS,
    );

    expect(selection).toEqual(PRO_CONTEXTS);
  });

  it("rend la sélection dans l'ordre des contextes, sans doublon", () => {
    const selection = parseContextSelection(
      `${NEXXIA},${TRUSTUP},${NEXXIA}`,
      PRO_CONTEXTS,
    );

    expect(selection).toEqual(PRO_CONTEXTS);
  });

  it("sérialise une sélection valide et refuse une valeur mal formée", () => {
    expect(serializeContextSelection([TRUSTUP, NEXXIA])).toBe(
      `${TRUSTUP},${NEXXIA}`,
    );
    expect(serializeContextSelection(["<script>"])).toBeNull();
  });
});

describe("vue de la to-do (cookie bmb_tasks_view)", () => {
  it("nomme le cookie de la vue bmb_tasks_view", () => {
    expect(TASKS_VIEW_COOKIE).toBe("bmb_tasks_view");
  });

  it("lit la vue Tableau enregistrée", () => {
    expect(parseTasksView("board")).toBe("board");
  });

  it("lit la vue Liste enregistrée", () => {
    expect(parseTasksView("list")).toBe("list");
  });

  it("un cookie absent retombe sur la liste", () => {
    expect(parseTasksView(undefined)).toBe("list");
  });

  it("une valeur inconnue retombe sur la liste", () => {
    expect(parseTasksView("kanban")).toBe("list");
  });

  it.each(["", "BOARD", " board", "board,list", "__proto__", "toString"])(
    "une valeur malformée (« %s ») retombe sur la liste",
    (raw) => {
      expect(parseTasksView(raw)).toBe("list");
    },
  );
});

describe("options du tableau (cookies bmb_board_*)", () => {
  beforeEach(() => jar.clear());

  it("un cookie par option, aux noms attendus", () => {
    expect(BOARD_OPTION_COOKIES).toEqual({
      subtasks: "bmb_board_subtasks",
      hideDoneSubtasks: "bmb_board_hide_done_subtasks",
      canceledOpen: "bmb_board_canceled_open",
    });
  });

  it("sans cookie : sous-tâches visibles, terminées non masquées, Annulée repliée", async () => {
    const options = await readBoardOptions();

    expect(options).toEqual({
      subtasks: true,
      hideDoneSubtasks: false,
      canceledOpen: false,
    });
  });

  it("lit les trois options enregistrées, chacune dans son cookie", async () => {
    jar.set("bmb_board_subtasks", "0");
    jar.set("bmb_board_hide_done_subtasks", "1");
    jar.set("bmb_board_canceled_open", "1");

    const options = await readBoardOptions();

    expect(options).toEqual({
      subtasks: false,
      hideDoneSubtasks: true,
      canceledOpen: true,
    });
  });

  it("une option enregistrée ne change pas les deux autres", async () => {
    jar.set("bmb_board_canceled_open", "1");

    const options = await readBoardOptions();

    expect(options).toEqual({
      subtasks: true,
      hideDoneSubtasks: false,
      canceledOpen: true,
    });
  });

  it.each(["", "true", "false", "2", "01", " 1", "1,0", "on", "null"])(
    "une valeur inconnue (« %s ») retombe sur le défaut de chaque option",
    (raw) => {
      expect(parseBoardOption("subtasks", raw)).toBe(true);
      expect(parseBoardOption("hideDoneSubtasks", raw)).toBe(false);
      expect(parseBoardOption("canceledOpen", raw)).toBe(false);
    },
  );

  it("« 1 » et « 0 » sont les seules valeurs lues", () => {
    expect(parseBoardOption("subtasks", "0")).toBe(false);
    expect(parseBoardOption("subtasks", "1")).toBe(true);
    expect(parseBoardOption("hideDoneSubtasks", "1")).toBe(true);
    expect(parseBoardOption("hideDoneSubtasks", "0")).toBe(false);
  });
});
