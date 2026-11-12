import type { MetadataRoute } from "next";
import { createTranslator } from "next-intl";

import { HOME_PATH } from "@/lib/auth/routes";
import { BACKGROUND_COLOR, THEME_COLOR } from "@/lib/theme";
import { defaultLocale } from "@/i18n/locales";

import messages from "../../messages/fr.json";

// Manifeste de la PWA (ADR-008), statique : textes de la langue par défaut, sans lire la requête
// (getTranslations passerait par request.ts, qui lit cookies et Accept-Language).
// raccourci: nom et description toujours en français, quelle que soit la langue de l'utilisateur — à revoir si un manifeste par langue devient utile (multi-comptes, BRAIN-26).
export default function manifest(): MetadataRoute.Manifest {
  const t = createTranslator({
    locale: defaultLocale,
    messages,
    namespace: "app",
  });

  return {
    name: t("name"),
    short_name: t("name"),
    description: t("description"),
    lang: defaultLocale,
    start_url: HOME_PATH,
    scope: "/",
    display: "standalone",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
