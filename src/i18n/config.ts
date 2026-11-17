import type { Formats } from "next-intl";

// Configuration partagée serveur / client : même fuseau et mêmes formats partout,
// sinon les dates rendues côté serveur et côté client divergent.
export const timeZone = "Europe/Brussels";

export const formats = {
  dateTime: {
    long: { dateStyle: "long" },
  },
} satisfies Formats;
