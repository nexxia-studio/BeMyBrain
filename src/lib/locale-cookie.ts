import "server-only";

import { cookies } from "next/headers";

import { isRenderCookieWriteError } from "@/lib/auth/server";
import { type AppLocale, LOCALE_COOKIE } from "@/i18n/locales";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Recopie la langue enregistrée du membre (source de vérité, ADR-007) dans NEXT_LOCALE, lu par
 * src/i18n/request.ts, si le cookie diffère. Écrit seulement en Server Action ou Route Handler :
 * pendant un rendu, Next refuse l'écriture et elle est ignorée (le cookie sera recopié à la prochaine
 * action, ou à la connexion). Toute autre erreur remonte.
 */
export async function syncLocaleCookie(locale: AppLocale): Promise<void> {
  const store = await cookies();
  if (store.get(LOCALE_COOKIE)?.value === locale) return;
  try {
    store.set(LOCALE_COOKIE, locale, {
      // Lu par next-intl côté serveur seulement.
      httpOnly: true,
      // WebKit refuse un cookie Secure sur http://localhost (gotcha e2e) : Secure en production.
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
  } catch (error) {
    if (isRenderCookieWriteError(error)) return;
    throw error;
  }
}
