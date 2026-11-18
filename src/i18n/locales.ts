export const locales = ["fr", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "fr";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | null | undefined): value is AppLocale {
  return locales.includes(value as AppLocale);
}

// « en-US,en;q=0.9,fr;q=0.8 » → ["en", "en", "fr"], trié par q décroissant.
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        weight: Number.isNaN(weight) ? 0 : weight,
        index,
      };
    })
    .filter(({ language, weight }) => language !== "" && weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map(({ language }) => language);
}

export function resolveLocale({
  cookie,
  acceptLanguage,
}: {
  cookie: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): AppLocale {
  const fromCookie = cookie?.trim().toLowerCase();
  if (isLocale(fromCookie)) return fromCookie;

  const fromHeader = acceptLanguage
    ? parseAcceptLanguage(acceptLanguage).find(isLocale)
    : undefined;

  return fromHeader ?? defaultLocale;
}

/**
 * Langue côté navigateur, quand ni le cookie (httpOnly) ni le fournisseur next-intl ne sont lisibles
 * (src/app/global-error.tsx) : `<html lang>`, posé par le layout racine depuis la langue enregistrée,
 * puis les langues du navigateur, puis fr.
 */
export function resolveClientLocale({
  documentLang,
  languages,
}: {
  documentLang: string | null | undefined;
  languages: readonly string[];
}): AppLocale {
  return resolveLocale({
    cookie: documentLang,
    acceptLanguage: languages.join(","),
  });
}
