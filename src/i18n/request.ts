import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { formats, timeZone } from "./config";
import { type AppLocale, LOCALE_COOKIE, resolveLocale } from "./locales";

// Chemins littéraux : eslint refuse les import() à source calculée (ADR-002).
const messageLoaders = {
  fr: () => import("../../messages/fr.json"),
  en: () => import("../../messages/en.json"),
} satisfies Record<AppLocale, () => Promise<{ default: unknown }>>;

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });

  return {
    locale,
    timeZone,
    formats,
    messages: (await messageLoaders[locale]()).default,
  };
});
