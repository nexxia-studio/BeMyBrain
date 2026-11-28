import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readSide = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
);

vi.mock("@/lib/preferences", () => ({ readSide }));
vi.mock("next/navigation", () => ({ redirect }));

import ListsLayout from "./layout";

beforeEach(() => vi.clearAllMocks());

describe("layout de /lists", () => {
  it("rend la page côté Privé", async () => {
    readSide.mockResolvedValue("private");

    render(await ListsLayout({ children: <p>courses</p> }));

    expect(screen.getByText("courses")).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("côté Pro : renvoi vers l'accueil avant tout rendu, aucune donnée de liste", async () => {
    readSide.mockResolvedValue("pro");

    await expect(ListsLayout({ children: <p>courses</p> })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
