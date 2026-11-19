import type { Formats } from "next-intl";

// Configuration partagée serveur / client : mêmes formats partout, sinon les dates rendues côté serveur et
// côté client divergent. Le fuseau vient de getUserTimeZone (src/modules/core/time-zone.ts).

export const formats = {
  dateTime: {
    long: { dateStyle: "long" },
  },
} satisfies Formats;
