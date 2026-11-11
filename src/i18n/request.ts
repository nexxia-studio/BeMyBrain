import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { formats, timeZone } from "./config";
import { LOCALE_COOKIE, resolveLocale } from "./locales";

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
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
