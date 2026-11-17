import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";

import { formats, timeZone } from "./config";

describe("formatage des dates", () => {
  it("une même date s'affiche « 11 novembre 2026 » en fr et « November 11, 2026 » en en", () => {
    const date = new Date("2026-11-11T12:00:00Z");

    const fr = createFormatter({ locale: "fr", formats, timeZone });
    const en = createFormatter({ locale: "en", formats, timeZone });

    expect(fr.dateTime(date, "long")).toBe("11 novembre 2026");
    expect(en.dateTime(date, "long")).toBe("November 11, 2026");
  });
});
