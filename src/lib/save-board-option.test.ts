import { beforeEach, describe, expect, it, vi } from "vitest";

const setBoardOption = vi.hoisted(() => vi.fn());

vi.mock("@/lib/preferences-actions", () => ({ setBoardOption }));

import { saveBoardOption } from "./save-board-option";

function clearCookies() {
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

beforeEach(() => {
  clearCookies();
  vi.clearAllMocks();
});

describe("saveBoardOption", () => {
  it("pose le cookie avant la fin de l'action serveur, puis l'appelle", async () => {
    setBoardOption.mockReturnValue(new Promise(() => {}));

    void saveBoardOption("subtasks", false, true);

    expect(document.cookie).toContain("bmb_board_subtasks=0");
    expect(setBoardOption).toHaveBeenCalledExactlyOnceWith("subtasks", false);
  });

  it("échec : le cookie retrouve l'ancienne valeur et l'erreur est relancée", async () => {
    setBoardOption.mockRejectedValue(new Error("panne"));

    await expect(saveBoardOption("canceledOpen", true, false)).rejects.toThrow(
      "panne",
    );

    expect(document.cookie).toContain("bmb_board_canceled_open=0");
  });

  it("réussite : le cookie garde la nouvelle valeur", async () => {
    setBoardOption.mockResolvedValue(undefined);

    await saveBoardOption("hideDoneSubtasks", true, false);

    expect(document.cookie).toContain("bmb_board_hide_done_subtasks=1");
  });
});
