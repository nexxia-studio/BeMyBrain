// Options communes de Sentry (serveur, edge, navigateur ; plan socle, tâche 19). Module pur : aucun import
// d'exécution de @sentry/nextjs, testable sans SDK. Aucune donnée personnelle ne part chez Sentry :
// sendDefaultPii faux, pas de replay, pas de tracing, et un nettoyage explicite de chaque événement.
import type { Breadcrumb, ErrorEvent, Event } from "@sentry/nextjs";

/** Variables lues, passées membre par membre : côté client, Next ne remplace que `process.env.X` littéral. */
export type SentryEnv = {
  SENTRY_DSN?: string | undefined;
  VERCEL_ENV?: string | undefined;
};

const ACTIVE_ENVIRONMENTS = new Set(["production", "preview"]);

// Liste blanche : seuls ces en-têtes restent dans un événement, tout autre est retiré (referer et origin,
// qui portent une URL avec sa query string, cookie, authorization, IP, géolocalisation Vercel, en-têtes à venir).
// Assez pour lire une panne : navigateur, langue, type de corps, hôte (production ou preview).
const KEPT_HEADERS = new Set([
  "user-agent",
  "accept-language",
  "content-type",
  "host",
]);

// Fils d'Ariane dont le message ou les données peuvent porter une saisie ou un objet journalisé.
const CONTENTLESS_BREADCRUMBS = new Set(["ui.input", "console"]);
const URL_BREADCRUMB_KEYS = ["url", "from", "to"] as const;

/** Retire la query string et le fragment d'une URL absolue ou relative. */
function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) =>
      KEPT_HEADERS.has(name.toLowerCase()),
    ),
  );
}

/** Nettoie un événement (erreur ou transaction) avant envoi. Exporté pour les tests. */
export function scrubEvent<T extends Event>(event: T): T {
  const scrubbed: T = { ...event };
  if (event.request) {
    // Corps, cookies et query string retirés ; l'URL perd aussi sa query string.
    const { data, cookies, query_string, headers, url, ...request } =
      event.request;
    void data;
    void cookies;
    void query_string;
    scrubbed.request = {
      ...request,
      ...(url === undefined ? {} : { url: withoutQuery(url) }),
      ...(headers === undefined ? {} : { headers: scrubHeaders(headers) }),
    };
  }
  if (event.user) {
    // Seul l'identifiant (uuid Neon Auth) est gardé : ni e-mail, ni IP, ni nom.
    scrubbed.user = event.user.id === undefined ? {} : { id: event.user.id };
  }
  const nextjs = event.contexts?.nextjs;
  if (nextjs && typeof nextjs.request_path === "string") {
    scrubbed.contexts = {
      ...event.contexts,
      nextjs: { ...nextjs, request_path: withoutQuery(nextjs.request_path) },
    };
  }
  return scrubbed;
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.category && CONTENTLESS_BREADCRUMBS.has(breadcrumb.category)) {
    const { message, data, ...rest } = breadcrumb;
    void message;
    void data;
    return rest;
  }
  if (!breadcrumb.data) return breadcrumb;
  const data = { ...breadcrumb.data };
  for (const key of URL_BREADCRUMB_KEYS) {
    if (typeof data[key] === "string") data[key] = withoutQuery(data[key]);
  }
  return { ...breadcrumb, data };
}

/** Origine https du DSN (point d'ingestion, sans la clé), pour connect-src ; rien sinon. */
export function sentryDsnOrigin(dsn: string | undefined): string | undefined {
  if (!dsn) return undefined;
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Options de `Sentry.init`, identiques sur les trois runtimes. Actif seulement avec un DSN ET sur une
 * production ou une preview Vercel : jamais en local, en CI, sous Vitest ni sous Playwright.
 * Aucune clé `integrations` ni `replays*` : pas de session replay.
 */
export function sentryOptions(env: SentryEnv) {
  const environment = env.VERCEL_ENV;
  const enabled =
    Boolean(env.SENTRY_DSN) &&
    environment !== undefined &&
    ACTIVE_ENVIRONMENTS.has(environment);

  return {
    enabled,
    dsn: enabled ? env.SENTRY_DSN : undefined,
    environment,
    sendDefaultPii: false,
    // Pas de tracing dans le socle.
    tracesSampleRate: 0,
    beforeSend: (event: ErrorEvent): ErrorEvent | null => scrubEvent(event),
    beforeSendTransaction: <T extends Event>(event: T): T => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb: Breadcrumb): Breadcrumb =>
      scrubBreadcrumb(breadcrumb),
  };
}
