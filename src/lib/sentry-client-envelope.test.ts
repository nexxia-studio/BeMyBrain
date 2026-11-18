// Client Sentry navigateur réellement initialisé (intégrations par défaut de @sentry/nextjs, dont le suivi
// de session), avec un transport factice : on lit les enveloppes telles qu'elles partiraient chez Sentry.
import { afterEach, describe, expect, it } from "vitest";

import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { sentryOptions } from "./sentry-options";

// Sous Vitest, `@sentry/nextjs` se résout vers l'entrée serveur (conditions Node). L'entrée navigateur est
// chargée par son chemin, en CommonJS : l'ESM importe « next/router » sans extension, refusé par Node.
type ClientSdk = {
  init: (options: object) => SentryClient | undefined;
  createTransport: (
    options: unknown,
    send: (request: {
      body: string | Uint8Array;
    }) => Promise<{ statusCode: number }>,
  ) => unknown;
  captureException: (error: unknown) => string;
  captureSession: () => void;
};
type SentryClient = {
  flush: (timeout: number) => Promise<boolean>;
  close: (timeout: number) => Promise<boolean>;
};

const require = createRequire(import.meta.url);
const sdk = require(
  join(
    dirname(require.resolve("@sentry/nextjs/package.json")),
    "build/cjs/index.client.js",
  ),
) as ClientSdk;

// Clé en `\w+` : le SDK refuse un DSN dont la clé publique contient un tiret.
const DSN = "https://clepublique@o1.ingest.example.test/42";

let client: SentryClient | undefined;

afterEach(async () => {
  await client?.close(1000);
  client = undefined;
});

async function sentEnvelopes(): Promise<string[]> {
  const bodies: string[] = [];
  client = sdk.init({
    ...sentryOptions({ SENTRY_DSN: DSN, VERCEL_ENV: "preview" }),
    // Sans release, le SDK jette les sessions : en production, le plugin Next en injecte une.
    release: "test",
    transport: (options: unknown) =>
      sdk.createTransport(options, async ({ body }) => {
        bodies.push(
          typeof body === "string" ? body : new TextDecoder().decode(body),
        );
        return { statusCode: 200 };
      }),
  });
  sdk.captureException(new Error("panne"));
  // La session ouverte par browserSessionIntegration part d'elle-même au premier temps mort du navigateur ;
  // envoyée ici sans attendre.
  sdk.captureSession();
  await client?.flush(2000);
  return bodies;
}

describe("enveloppes du client Sentry navigateur", () => {
  it("un événement part avec infer_ip « never » : Sentry ne déduit aucune IP", async () => {
    const bodies = await sentEnvelopes();

    const event = bodies.find((body) => body.includes('"type":"event"'));
    expect(event).toBeDefined();
    expect(event).toContain('"infer_ip":"never"');
    expect(event).not.toContain('"infer_ip":"auto"');
  });

  it("la session part sans adresse IP", async () => {
    const bodies = await sentEnvelopes();

    const session = bodies.find((body) => body.includes('"type":"session"'));
    expect(session).toBeDefined();
    expect(session).not.toContain("{{auto}}");
    expect(session).not.toContain("ip_address");
  });
});
