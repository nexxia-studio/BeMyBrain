"use client";

// Curseurs nexxia-design : VARIANCE 2 · MOTION 1 · DENSITY 3 — mêmes que src/app/error.tsx, dont c'est le pendant.
// Mobile d'abord : une colonne centrée, pleine largeur à 390 px, plafonnée à max-w-sm au-delà (pas de multi-colonnes).
import { captureException } from "@sentry/nextjs";
import { createTranslator } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";

import {
  type AppLocale,
  defaultLocale,
  resolveClientLocale,
} from "@/i18n/locales";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

import "./globals.css";

type GlobalErrorProps = {
  error: unknown;
  retry: () => void;
};

// Hors du layout racine, donc hors de NextIntlClientProvider (ADR-007) : on traduit avec les clés `errors`
// des fichiers de messages, seule partie gardée ici. Rien d'autre des messages n'entre dans ce morceau.
const errorMessages = {
  fr: { errors: fr.errors },
  en: { errors: en.errors },
} satisfies Record<AppLocale, { errors: typeof fr.errors }>;

function subscribe(): () => void {
  return () => {};
}

function readClientLocale(): AppLocale {
  return resolveClientLocale({
    documentLang: document.documentElement.lang,
    languages: navigator.languages,
  });
}

/**
 * Erreur du layout racine (Next remplace tout le document). Texte fixe et traduit : jamais le message ni le
 * digest de l'erreur. La langue vient de `<html lang>` de la page remplacée (choix enregistré de l'utilisateur),
 * à défaut du navigateur ; au rendu serveur, fr. L'erreur est envoyée à Sentry (inactif hors production/preview).
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  const locale = useSyncExternalStore(
    subscribe,
    readClientLocale,
    () => defaultLocale,
  );
  const t = createTranslator({
    locale,
    messages: errorMessages[locale],
    namespace: "errors",
  });

  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body className="min-h-full flex flex-col">
        <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
          <h1 className="font-heading text-page-title">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
          <button
            type="button"
            onClick={() => retry()}
            className="min-h-11 self-start rounded-lg px-4 text-sm font-medium underline underline-offset-4"
          >
            {t("retry")}
          </button>
        </main>
      </body>
    </html>
  );
}
