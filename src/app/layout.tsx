import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { SignaturePrehideScript } from "@/components/signature/SignaturePrehideScript";
import { THEME_COLOR } from "@/lib/theme";

import "./globals.css";

// Polices de DESIGN.md : Inter (texte), Space Grotesk (titres, chiffres). Variables lues par @theme.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

// viewportFit "cover" : en standalone iOS, la page s'étend sous la barre d'accueil et, en paysage,
// sous l'encoche ; la barre d'état reste opaque (statusBarStyle "default", --safe-top = 0 en portrait).
// La coque (tâche 14) s'en écarte avec --safe-bottom et les côtés (globals.css, DESIGN.md § 9).
export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "light",
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");

  return {
    title: t("name"),
    description: t("description"),
    // PWA iOS (ADR-008) : barre d'état « default » = texte sombre sur fond clair (DESIGN.md § 9).
    appleWebApp: {
      capable: true,
      title: t("name"),
      statusBarStyle: "default",
    },
    icons: {
      apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    // suppressHydrationWarning : le script de masquage pose data-signature-pending sur <html> avant
    // l'hydratation (attributs de cet élément seulement, pas de ses enfants).
    <html
      suppressHydrationWarning
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <head>
        {/* Avant toute peinture : masque les cibles des moments signature encore à jouer (ADR-006). */}
        <SignaturePrehideScript />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
