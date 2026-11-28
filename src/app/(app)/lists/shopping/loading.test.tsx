import { render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../../messages/fr.json";

const pageHeaderProps = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "shopping") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string }) => {
    pageHeaderProps(props);
    return <h1>{props.title}</h1>;
  },
}));

import ShoppingLoading from "./loading";

async function renderLoading() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      {await ShoppingLoading()}
    </NextIntlClientProvider>,
  );
}

describe("chargement des courses", () => {
  it("affiche le vrai titre, un statut et un givre masqué aux lecteurs d'écran", async () => {
    await renderLoading();

    expect(pageHeaderProps).toHaveBeenCalledWith({
      title: messages.shopping.title,
      contextFilter: false,
    });
    expect(screen.getByRole("status").textContent).toBe(
      messages.shopping.loading,
    );
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    const frost = screen.getByTestId("shopping-frost");
    expect(frost.getAttribute("aria-hidden")).toBe("true");
    expect(frost.querySelectorAll(".frost").length).toBeGreaterThan(0);
  });
});
