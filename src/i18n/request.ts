import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { getUserTimeZone } from "@/modules/core/time-zone";

import { formats } from "./config";
import { type AppLocale, LOCALE_COOKIE, resolveLocale } from "./locales";

// Chemins littéraux : eslint refuse les import() à source calculée (ADR-002).
// La section `errors` vit dans son propre fichier : global-error (hors NextIntlClientProvider) l'importe
// seule, Turbopack n'élaguant pas un JSON. Elle est refusionnée ici, sous la même clé.
const messageLoaders = {
  fr: async () => ({
    ...(await import("../../messages/fr.json")).default,
    errors: (await import("../../messages/errors/fr.json")).default,
  }),
  en: async () => ({
    ...(await import("../../messages/en.json")).default,
    errors: (await import("../../messages/errors/en.json")).default,
  }),
} satisfies Record<AppLocale, () => Promise<object>>;

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });

  return {
    locale,
    timeZone: getUserTimeZone(),
    formats,
    messages: await messageLoaders[locale](),
  };
});
