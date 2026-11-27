import { AsyncLocalStorage } from "node:async_hooks";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// Posé par le runtime Node de Next avant tout module (proxy, next/headers) ; absent sous Vitest.
Object.assign(globalThis, { AsyncLocalStorage });

// jsdom ne défile rien et ne définit pas `scrollIntoView` ; les tests qui l'observent le remplacent par un espion.
if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = () => {};
}
