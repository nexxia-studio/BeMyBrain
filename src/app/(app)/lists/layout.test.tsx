import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readSide = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("@/lib/preferences", () => ({ readSide }));
vi.mock("next/navigation", () => ({ notFound }));

import ListsLayout from "./layout";

beforeEach(() => vi.clearAllMocks());

describe("layout de /lists", () => {
  it("rend la page côté Privé", async () => {
    readSide.mockResolvedValue("private");

    render(await ListsLayout({ children: <p>courses</p> }));

    expect(screen.getByText("courses")).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("côté Pro : 404 avant tout rendu, aucune donnée de liste", async () => {
    readSide.mockResolvedValue("pro");

    await expect(ListsLayout({ children: <p>courses</p> })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledOnce();
  });
});
