import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readCspNonce = vi.hoisted(() => vi.fn());

vi.mock("@/lib/csp-nonce", () => ({ readCspNonce }));

import { signaturePrehideScript } from "./signature-keys";
import { SignaturePrehideScript } from "./SignaturePrehideScript";

beforeEach(() => {
  readCspNonce.mockReset();
});

describe("script de masquage des moments signature", () => {
  it("porte le nonce CSP de la requête", async () => {
    readCspNonce.mockResolvedValue("bm9uY2U=");

    const { container } = render(await SignaturePrehideScript());

    expect(container.querySelector("script")?.getAttribute("nonce")).toBe(
      "bm9uY2U=",
    );
  });

  it("exécute le masquage, sans aucune donnée de la requête", async () => {
    readCspNonce.mockResolvedValue("bm9uY2U=");

    const { container } = render(await SignaturePrehideScript());

    expect(container.querySelector("script")?.innerHTML).toBe(
      signaturePrehideScript(),
    );
  });
});
