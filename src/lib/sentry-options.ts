// Options communes de Sentry (serveur, edge, navigateur ; plan socle, tâche 19). Module pur : aucun import
// d'exécution de @sentry/nextjs, testable sans SDK. Aucune donnée personnelle ne part chez Sentry :
// dataCollection tout coupé (SDK v11 : `sendDefaultPii` n'existe plus, ses défauts collectent tout),
// pas de replay, pas de tracing, et un nettoyage explicite de chaque événement.
import type {
  Breadcrumb,
  BreadcrumbHint,
  BrowserOptions,
  EdgeOptions,
  ErrorEvent,
  Event,
  NodeOptions,
} from "@sentry/nextjs";

/** Variables lues, passées membre par membre : côté client, Next ne remplace que `process.env.X` littéral. */
export type SentryEnv = {
  SENTRY_DSN?: string | undefined;
  VERCEL_ENV?: string | undefined;
};

/** Options valables sur les trois runtimes : une clé inconnue de l'un d'eux casse la compilation. */
type SentryInitOptions = BrowserOptions & NodeOptions & EdgeOptions;

const ACTIVE_ENVIRONMENTS = new Set(["production", "preview"]);

// Liste blanche : seuls ces en-têtes restent dans un événement, tout autre est retiré (referer et origin,
// qui portent une URL avec sa query string, cookie, authorization, IP, géolocalisation Vercel, en-têtes à venir).
// Assez pour lire une panne : navigateur, langue, type de corps, hôte (production ou preview).
const KEPT_HEADERS = ["user-agent", "accept-language", "content-type", "host"];
const KEPT_HEADER_SET = new Set(KEPT_HEADERS);

// Collecte du SDK (types : @sentry/core, types/datacollection.d.ts). Tout ce qui vaut `true` par défaut est
// coupé. `userInfo: false` pose aussi `infer_ip: "never"` sur les événements et retire l'IP « {{auto}} » des
// sessions navigateur (BrowserClient, 11.13.0) : le suivi de session reste, sans IP.
// `frameContextLines` garde son défaut : lignes de notre code source autour d'une frame, pas une donnée.
// L'`allow` des en-têtes est une correspondance par sous-chaîne (« host » garde x-forwarded-host) :
// beforeSend refait le tri par nom exact.
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: KEPT_HEADERS }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies SentryInitOptions["dataCollection"];

// Contextes gardés : de quoi situer une panne (route, runtime, système, navigateur, appareil, langue, trace).
// Tout autre est retiré (state Redux, response, contextes ajoutés par une intégration à venir).
const KEPT_CONTEXTS = new Set([
  "nextjs",
  "runtime",
  "os",
  "browser",
  "device",
  "culture",
  "trace",
]);

// Fils d'Ariane dont le message ou les données peuvent porter une saisie ou un objet journalisé.
const CONTENTLESS_BREADCRUMBS = new Set(["ui.input", "console"]);
const URL_BREADCRUMB_KEYS = ["url", "from", "to"] as const;
// Base fictive pour résoudre une URL relative ; une URL qui en sort (« //hôte/… ») vise un autre site.
const RELATIVE_BASE = "https://relative.invalid";
// Décodages successifs admis pour le chemin d'une URL de fil (« a%2540b » = deux).
const MAX_PATH_DECODES = 3;
// Longueur maximale d'un texte libre avant masquage (voir maskText).
const MAX_TEXT_LENGTH = 2000;
// Valeur libre de `data` lue comme une URL absolue (voir maskDataValue).
const HTTP_URL = /^https?:\/\//i;
// Seules balises envoyées pour un clic, lues sur l'élément ou, sans indice (addBreadcrumb manuel, second passage
// par scrubEvent), dans le message : liste fermée, un mot quelconque (« dupont », « x-foo ») ne passe pas.
const STANDARD_TAGS = new Set([
  "a",
  "abbr",
  "article",
  "aside",
  "audio",
  "b",
  "body",
  "button",
  "canvas",
  "caption",
  "circle",
  "code",
  "dd",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "g",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "iframe",
  "img",
  "input",
  "label",
  "legend",
  "li",
  "main",
  "menu",
  "nav",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "path",
  "picture",
  "pre",
  "progress",
  "rect",
  "section",
  "select",
  "small",
  "span",
  "strong",
  "summary",
  "svg",
  "table",
  "tbody",
  "td",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "use",
  "video",
]);
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
// Hôte d'une branche Neon (identifiant d'infrastructure) : masqué dans les fils.
const NEON_HOST_SUFFIX = ".neon.tech";
const NEON_PLACEHOLDER = "https://[neon]";
// Données des fils HTTP serveur (conventions OpenTelemetry) qui portent la query string ou le fragment.
const QUERY_BREADCRUMB_KEYS = [
  "url.query",
  "url.fragment",
  "http.query",
  "http.fragment",
];

type TextMask = [
  RegExp,
  string | ((match: string, ...groups: string[]) => string),
];

/** Valeur d'un secret masquée en entier ; ses guillemets éventuels gardés. */
function maskSecretValue(
  _match: string,
  key: string,
  separator: string,
  value: string,
): string {
  const quote = /^\\?["']/.exec(value)?.[0] ?? "";
  return `${key}${separator}${quote}[Filtered]${quote}`;
}

// Secrets ou données personnelles reconnaissables dans un texte libre (message d'erreur, log).
// Ordre : l'URL Postgres d'abord (son « user:mdp@hôte » ressemble à un e-mail) ; l'hôte Neon en dernier
// (masqué avant, il casserait le masque d'un e-mail ou d'une URL Postgres et en laisserait une partie).
const TEXT_MASKS: TextMask[] = [
  [/postgres(?:ql)?:\/\/\S+/giu, "[postgres-url]"],
  [/Bearer\s+[^\s"',;]+/giu, "Bearer [Filtered]"],
  // Clé de secret, seule ou en suffixe après « _ » (user_password, access_token), ou secret_… (secret_key),
  // suivie de « = » ou « : », y compris en JSON (« "password":"x" ») et en JSON échappé deux fois
  // (« {\"password\":\"x\"} », clé et valeur délimitées par « \" »). Valeur entre guillemets : masquée jusqu'au
  // guillemet fermant non échappé (ou la fin), échappements compris (retour à la ligne) ; sans guillemet :
  // jusqu'à un espace ou « & » (paramètre suivant d'une query).
  [
    /\b((?:\w*?_)?(?:passwd|password|pwd|token|secret(?:_\w+)?))(\\?"?\s*[:=]\s*)(\\"(?:(?!\\")[\s\S])*(?:\\")?|\\'(?:(?!\\')[\s\S])*(?:\\')?|"(?:[^"\\]|\\[\s\S])*"?|'(?:[^'\\]|\\[\s\S])*'?|[^\s&]+)/giu,
    maskSecretValue,
  ],
  [/eyJ[\w-]*\.[\w-]+\.[\w-]*/gu, "[jwt]"],
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, "[email]"],
  [/[\w-]+(?:\.[\w-]+)*\.neon\.tech/giu, "[neon]"],
];

// Point d'ingestion admis dans la CSP : https, hôte sans caractère spécial, sous-domaine de sentry.io.
const SENTRY_ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/;
const SENTRY_HOST_SUFFIX = ".sentry.io";

/** Retire la query string et le fragment d'une URL absolue ou relative. */
function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

/**
 * Masque e-mails, JWT, URL Postgres, hôtes Neon, secrets et jetons Bearer d'un texte libre. Tronqué à
 * MAX_TEXT_LENGTH avant les masques (les masques e-mail et Neon sont quadratiques : 200 000 caractères ≈ 30 s),
 * puis de nouveau après (un masque peut allonger le texte : « a@b.fr » → « [email] »), pour que le second passage
 * (scrubEvent) laisse le résultat identique. Le dernier mot coupé par la limite est retiré : coupé, un e-mail ou un
 * secret ne serait plus reconnu.
 */
function maskText(text: string): string {
  const masked = TEXT_MASKS.reduce(
    (masked, [pattern, replacement]) =>
      // Branches identiques : seul le typage l'impose (String.replace n'accepte pas l'union des deux formes).
      typeof replacement === "string"
        ? masked.replace(pattern, replacement)
        : masked.replace(pattern, replacement),
    truncate(text),
  );
  return truncate(masked);
}

/** Résultat « … » compris borné à MAX_TEXT_LENGTH ; un texte déjà dans la limite est rendu tel quel. */
function truncate(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  let end = MAX_TEXT_LENGTH - 1;
  if (!/\s/u.test(text[end])) {
    while (end > 0 && !/\s/u.test(text[end - 1])) end--;
  }
  return `${text.slice(0, end)}…`;
}

/** Une chaîne est masquée, un nombre ou un booléen gardé, tout autre valeur remplacée. */
function maskParam(param: unknown): unknown {
  if (typeof param === "string") return maskText(param);
  if (typeof param === "number" || typeof param === "boolean") return param;
  return "[Filtered]";
}

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) =>
      KEPT_HEADER_SET.has(name.toLowerCase()),
    ),
  );
}

type Contexts = NonNullable<Event["contexts"]>;

function scrubContexts(contexts: Contexts): Contexts {
  const kept: Contexts = {};
  for (const [name, context] of Object.entries(contexts)) {
    if (KEPT_CONTEXTS.has(name) && context) kept[name] = context;
  }
  if (kept.trace) {
    // Les données de trace reprennent les attributs de la requête (URL, query).
    const { data, ...trace } = kept.trace;
    void data;
    kept.trace = trace;
  }
  const nextjs = kept.nextjs;
  if (nextjs && typeof nextjs.request_path === "string") {
    kept.nextjs = {
      ...nextjs,
      request_path: withoutQuery(nextjs.request_path),
    };
  }
  return kept;
}

/** Nettoie un événement avant envoi. Exporté pour les tests. */
export function scrubEvent<T extends Event>(event: T): T {
  // `extra` retiré entier : objets arbitraires joints par le code ou une intégration.
  const { extra, ...rest } = event;
  void extra;
  const scrubbed = rest as T;
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
  if (event.contexts) scrubbed.contexts = scrubContexts(event.contexts);
  // Filet : un fil ajouté sans passer par beforeBreadcrumb (ou par une intégration qui le contourne).
  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs.map((breadcrumb) =>
      scrubBreadcrumb(breadcrumb),
    );
  }
  if (event.message !== undefined) scrubbed.message = maskText(event.message);
  if (event.logentry) {
    const { message, params } = event.logentry;
    scrubbed.logentry = {
      ...(message === undefined ? {} : { message: maskText(message) }),
      ...(params === undefined ? {} : { params: params.map(maskParam) }),
    };
  }
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((exception) =>
        exception.value === undefined
          ? exception
          : { ...exception, value: maskText(exception.value) },
      ),
    };
  }
  return scrubbed;
}

/**
 * Balise de l'élément cliqué, lue sur la cible de l'événement DOM que le SDK navigateur passe en indice.
 * Le message du SDK (sélecteur CSS avec id, classes, aria-label, title, name, alt et parents, ou nom de
 * composant) n'est jamais analysé : un libellé à guillemets impairs pourrait y passer pour une balise.
 * Sans élément lisible (serveur, autre fil `ui.*`) : rien. Aucune dépendance à `Element` global.
 */
function clickedTag(hint: BreadcrumbHint | undefined): string | undefined {
  const event: unknown = hint?.event;
  if (typeof event !== "object" || event === null) return undefined;
  const target: unknown = (event as { target?: unknown }).target;
  if (typeof target !== "object" || target === null) return undefined;
  const tagName: unknown = (target as { tagName?: unknown }).tagName;
  if (typeof tagName !== "string") return undefined;
  const tag = tagName.toLowerCase();
  return STANDARD_TAGS.has(tag) ? tag : undefined;
}

/**
 * URL d'un fil : relative ou de la page → chemin sans query ni fragment ; autre site (ou toute URL absolue
 * côté serveur, sans `location`) → origine seule ; hôte Neon → `https://[neon]` ; schéma autre que http(s)
 * (blob:, data:, ftp:…) ou non analysable → undefined (retirée).
 */
function scrubBreadcrumbUrl(value: string): string | undefined {
  // Déjà nettoyée (second passage par scrubEvent) : « [neon] » n'est pas un hôte analysable.
  if (value === NEON_PLACEHOLDER) return value;
  const pageOrigin = (globalThis as { location?: { origin?: string } }).location
    ?.origin;
  let resolved: URL;
  try {
    resolved = new URL(value, RELATIVE_BASE);
  } catch {
    return undefined;
  }
  if (resolved.origin === RELATIVE_BASE) return maskPath(withoutQuery(value));
  if (!WEB_PROTOCOLS.has(resolved.protocol)) return undefined;
  const host = resolved.hostname;
  if (host === NEON_HOST_SUFFIX.slice(1) || host.endsWith(NEON_HOST_SUFFIX))
    return NEON_PLACEHOLDER;
  return resolved.origin === pageOrigin
    ? maskPath(resolved.pathname)
    : resolved.origin;
}

/** Chemin décodé (un e-mail encodé « a%40b.fr » devient visible au masque) puis masqué ; codage invalide → undefined. */
function maskPath(path: string): string | undefined {
  // Décodage répété (« a%2540b » → « a%40b » → « a@b ») : un e-mail encodé plusieurs fois reste visible au masque.
  // Tout décodage en échec (codage invalide, « % » littéral) ou chemin encore décodable après MAX_PATH_DECODES
  // passages → retiré.
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  for (let pass = 1; ; pass++) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return undefined;
    }
    if (next === decoded) break;
    if (pass >= MAX_PATH_DECODES) return undefined;
    decoded = next;
  }
  // Réencodage de « % », « ? » et « # » : le second passage (scrubEvent) relit le même chemin.
  return maskText(decoded).replace(
    /[%?#]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Valeur libre de `data` d'un fil : une valeur qui ressemble à une URL (http(s) absolue ou chemin « / », sans espace) est
 * nettoyée comme `url` (undefined → clé retirée) ; texte masqué ; nombre, booléen ou vide gardé ; objet remplacé.
 */
function maskDataValue(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      !/\s/u.test(trimmed) &&
      (HTTP_URL.test(trimmed) || trimmed.startsWith("/"))
    )
      return scrubBreadcrumbUrl(trimmed);
  }
  return maskParam(value);
}

function scrubBreadcrumb(
  breadcrumb: Breadcrumb,
  hint?: BreadcrumbHint,
): Breadcrumb {
  // Catégorie comparée en minuscules : « UI.click » ou « Console » ne contournent pas le nettoyage.
  const category = breadcrumb.category?.toLowerCase();
  if (category !== undefined && CONTENTLESS_BREADCRUMBS.has(category)) {
    const { message, data, ...rest } = breadcrumb;
    void message;
    void data;
    return rest;
  }
  if (category === "ui" || category?.startsWith("ui.")) {
    // `data` retiré : il porte le nom du composant (ui.component_name).
    const { message, data, ...rest } = breadcrumb;
    void message;
    void data;
    // Avec un indice : seule la balise lue sur la cible, jamais le message. Sans indice (addBreadcrumb manuel,
    // second passage par scrubEvent) : le message seulement s'il est une balise HTML de la liste fermée.
    const tag =
      hint === undefined
        ? message !== undefined && STANDARD_TAGS.has(message)
          ? message
          : undefined
        : clickedTag(hint);
    return tag === undefined ? rest : { ...rest, message: tag };
  }
  const scrubbed: Breadcrumb = { ...breadcrumb };
  // Message libre d'un fil (intégration child_process de @sentry/node, addBreadcrumb manuel).
  if (breadcrumb.message !== undefined)
    scrubbed.message = maskText(breadcrumb.message);
  if (!breadcrumb.data) return scrubbed;
  const data = { ...breadcrumb.data };
  for (const key of URL_BREADCRUMB_KEYS) {
    if (!(key in data)) continue;
    const value: unknown = data[key];
    const url =
      typeof value === "string" ? scrubBreadcrumbUrl(value) : undefined;
    if (url === undefined) delete data[key];
    else data[key] = url;
  }
  for (const key of QUERY_BREADCRUMB_KEYS) delete data[key];
  const urlKeys: readonly string[] = URL_BREADCRUMB_KEYS;
  for (const [key, value] of Object.entries(data)) {
    if (urlKeys.includes(key)) continue;
    const masked = maskDataValue(value);
    if (masked === undefined && value !== undefined) delete data[key];
    else data[key] = masked;
  }
  return { ...scrubbed, data };
}

/** Origine https d'un DSN sentry.io (point d'ingestion, sans la clé), pour connect-src ; rien sinon. */
export function sentryDsnOrigin(dsn: string | undefined): string | undefined {
  if (!dsn) return undefined;
  try {
    const url = new URL(dsn);
    return SENTRY_ORIGIN.test(url.origin) &&
      url.hostname.endsWith(SENTRY_HOST_SUFFIX)
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Options de `Sentry.init`, identiques sur les trois runtimes. Actif seulement avec un DSN https://*.sentry.io ET sur une
 * production ou une preview Vercel : jamais en local, en CI, sous Vitest ni sous Playwright.
 * Aucune clé `integrations` ni `replays*` : pas de session replay.
 * Aucun `tracesSampleRate` : pas de tracing ; `tracePropagationTargets` vide : aucun en-tête
 * `sentry-trace` / `baggage` ajouté aux requêtes sortantes (sans liste, le SDK serveur les pose partout).
 */
export function sentryOptions(env: SentryEnv) {
  const environment = env.VERCEL_ENV;
  // Même règle que la CSP (connect-src) : un DSN hors https://*.sentry.io laisse Sentry inactif, sinon
  // le navigateur enverrait vers une origine que la CSP bloque, et le serveur vers une origine non vérifiée.
  const enabled =
    sentryDsnOrigin(env.SENTRY_DSN) !== undefined &&
    environment !== undefined &&
    ACTIVE_ENVIRONMENTS.has(environment);

  return {
    enabled,
    dsn: enabled ? env.SENTRY_DSN : undefined,
    environment,
    dataCollection: DATA_COLLECTION,
    tracePropagationTargets: [],
    beforeSend: (event: ErrorEvent): ErrorEvent | null => scrubEvent(event),
    beforeBreadcrumb: (
      breadcrumb: Breadcrumb,
      hint?: BreadcrumbHint,
    ): Breadcrumb => scrubBreadcrumb(breadcrumb, hint),
  } satisfies SentryInitOptions;
}
