// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import Home from "./page";

describe("page d'accueil provisoire", () => {
  it("redirige vers /dashboard", () => {
    const run = () => Home();

    expect(run).toThrow("REDIRECT:/dashboard");
  });
});
