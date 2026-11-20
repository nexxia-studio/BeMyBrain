import { render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../../messages/fr.json";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const loadTrash = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("@/components/trash/trash-types", () => ({ loadTrash }));
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "trash") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son titre.
const PageHeader = vi.hoisted(() => vi.fn());
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string; contextFilter?: boolean }) => {
    PageHeader(props);
    return <h1>{props.title}</h1>;
  },
}));

import TrashPage from "./page";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "Atelier Monie",
};

async function renderPage() {
  const element = await TrashPage();
  return render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  requireSessionWithToken.mockResolvedValue({
    session: SESSION,
    token: "jeton",
  });
});

afterEach(() => vi.clearAllMocks());

describe("page /trash", () => {
  it("lit la corbeille du workspace de la session, sans filtre d'espace (corbeille de toute l'app)", async () => {
    loadTrash.mockResolvedValue([
      {
        key: "task:1",
        deletedAt: new Date("2026-11-18T09:00:00Z"),
        restore: { action: "tasks.restore", params: { taskId: "1" } },
        row: <span>Déménager</span>,
      },
    ]);

    await renderPage();

    expect(loadTrash).toHaveBeenCalledWith("jeton", SESSION.workspaceId);
    expect(PageHeader).toHaveBeenCalledWith({
      title: "Corbeille",
      contextFilter: false,
    });
    expect(screen.getByText("Déménager")).toBeTruthy();
  });

  it("corbeille vide : « La corbeille est vide »", async () => {
    loadTrash.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByText("La corbeille est vide")).toBeTruthy();
  });
});
