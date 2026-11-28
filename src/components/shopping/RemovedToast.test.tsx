import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../../messages/fr.json";

import { RemovedToast } from "./RemovedToast";

describe("RemovedToast", () => {
  it("se pose au-dessus du champ d'ajout collant, pas à la hauteur de la barre d'onglets", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <RemovedToast item={null} onUndo={() => {}} />
      </NextIntlClientProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("bottom-toast-above-field");
    expect(root.className).toContain("lg:bottom-toast-above-field-lg");
    expect(root.className).not.toContain("bottom-tabbar-reserve");
    expect(root.className).toContain("z-(--z-toast)");
  });
});
