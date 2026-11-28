// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
const requireSession = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/session", () => ({ requireSession }));

import ListsPage from "./page";

describe("page /lists", () => {
  it("vérifie la session puis ouvre sur Courses", async () => {
    await ListsPage();

    expect(requireSession).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/lists/shopping");
  });
});
