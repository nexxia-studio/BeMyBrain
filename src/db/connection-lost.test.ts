// @vitest-environment node
import { DatabaseError as DriverDatabaseError } from "@neondatabase/serverless";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vitest";

import { DomainError } from "@/lib/errors";

import { isConnectionLost } from "./connection-lost";
import {
  DatabaseError,
  IdentityNotAppliedError,
  InvalidTokenError,
  TokenVerificationUnavailableError,
} from "./user-db";

// Messages exacts du pilote pg embarqué (@neondatabase/serverless 1.2.0, index.mjs) : fermeture du socket
// (« end » du flux) et requête sur un client devenu non requêtable.
const DRIVER_MESSAGES = [
  "Connection terminated unexpectedly",
  "Connection terminated",
  "Client was closed and is not queryable",
  "Client has encountered a connection error and is not queryable",
];

/** Erreur serveur telle que la lève le pilote : message du serveur, SQLSTATE dans `code`. */
function serverError(code: string) {
  const error = new DriverDatabaseError("message du serveur", 0, "error");
  error.code = code;
  return error;
}

/** Enveloppe de Drizzle autour de l'erreur du pilote : le message et le SQLSTATE sont sur la cause. */
function wrapped(cause: Error) {
  return new DrizzleQueryError("select 1", [], cause);
}

class TestDomainError extends DomainError {
  override name = "TestDomainError";
}

const CONNECTION_SQLSTATES = [
  "08000",
  "08003",
  "08006",
  "08001",
  "08P01",
  "57P01",
  "57P02",
  "57P03",
];

describe("isConnectionLost : erreurs de connexion", () => {
  it.each(DRIVER_MESSAGES)(
    "vrai pour le message du pilote « %s »",
    (message) => {
      const error = new Error(message);

      expect(isConnectionLost(error)).toBe(true);
    },
  );

  it.each(DRIVER_MESSAGES)(
    "vrai pour « %s » sous l'enveloppe de Drizzle",
    (message) => {
      const error = wrapped(new Error(message));

      expect(isConnectionLost(error)).toBe(true);
    },
  );

  it.each(CONNECTION_SQLSTATES)("vrai pour le SQLSTATE %s", (code) => {
    const error = serverError(code);

    expect(isConnectionLost(error)).toBe(true);
  });

  it.each(CONNECTION_SQLSTATES)(
    "vrai pour le SQLSTATE %s sous l'enveloppe de Drizzle",
    (code) => {
      const error = wrapped(serverError(code));

      expect(isConnectionLost(error)).toBe(true);
    },
  );
});

describe("isConnectionLost : pas une erreur de connexion", () => {
  it.each(["42501", "23505", "42P01", "40001", "57014", "22P02"])(
    "faux pour le SQLSTATE %s, nu ou sous l'enveloppe de Drizzle",
    (code) => {
      expect(isConnectionLost(serverError(code))).toBe(false);
      expect(isConnectionLost(wrapped(serverError(code)))).toBe(false);
    },
  );

  it.each([
    ["InvalidTokenError", () => new InvalidTokenError("ERR_JWT_EXPIRED")],
    [
      "TokenVerificationUnavailableError",
      () => new TokenVerificationUnavailableError("ERR_JWKS_TIMEOUT"),
    ],
    ["IdentityNotAppliedError", () => new IdentityNotAppliedError()],
    ["DomainError", () => new TestDomainError("not_found")],
  ] as const)("faux pour %s", (_name, make) => {
    expect(isConnectionLost(make())).toBe(false);
  });

  it("faux pour une DatabaseError déjà masquée, même avec un SQLSTATE de connexion", () => {
    const error = new DatabaseError("57P01");

    expect(isConnectionLost(error)).toBe(false);
  });

  it.each([
    "Connection terminated due to connection timeout",
    "timeout exceeded when trying to connect",
    "Cannot use a pool after calling end on the pool",
    "terminated",
    "Query read timeout",
    "socket hang up",
    "erreur quelconque",
  ])("faux pour le message « %s »", (message) => {
    expect(isConnectionLost(new Error(message))).toBe(false);
    expect(isConnectionLost(wrapped(new Error(message)))).toBe(false);
  });

  it("faux quand le message du pilote n'est qu'une partie du message", () => {
    const error = new Error("Failed query: Connection terminated unexpectedly");

    expect(isConnectionLost(error)).toBe(false);
  });

  it("faux pour une cause de connexion enfouie au-delà d'un niveau", () => {
    const error = wrapped(wrapped(new Error("Connection terminated")));

    expect(isConnectionLost(error)).toBe(false);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["une chaîne", "Connection terminated unexpectedly"],
    ["un nombre", 57],
    ["un objet avec un SQLSTATE", { code: "57P01" }],
    ["un objet avec le message", { message: "Connection terminated" }],
  ])("faux pour une valeur non Error : %s", (_name, value) => {
    expect(isConnectionLost(value)).toBe(false);
  });
});
