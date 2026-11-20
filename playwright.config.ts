import { defineConfig, devices } from "@playwright/test";

import { assertE2eTargetAllowed } from "./scripts/e2e-target.mjs";

// Identifiants du compte e2e (E2E_USER_EMAIL, E2E_USER_PASSWORD) : .env en local, absent en CI.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// Local par défaut ; E2E_BASE_URL vise une preview HTTPS (sans serveur local).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isLocal = new URL(baseURL).protocol === "http:";
// Jamais contre la production : chargement refusé si l'hôte est listé dans E2E_FORBIDDEN_HOSTS.
// raccourci: l'URL *.vercel.app de production n'est pas distinguable d'une preview sans le nom du projet —
// la lister dans E2E_FORBIDDEN_HOSTS à la création du projet Vercel (tâche 17).
assertE2eTargetAllowed(baseURL, process.env.E2E_FORBIDDEN_HOSTS);

// Parcours qui modifient le compte e2e partagé (sa langue) : réglages, palette de commandes, to-do en anglais.
const ACCOUNT_LOCALE_SPEC =
  /(changer-de-langue|palette|todo-langue)\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  // Un seul worker : Neon Auth limite le débit des connexions (429) sur le compte e2e partagé (docs/gotchas.md).
  // Pour paralléliser un jour : une connexion unique réutilisée via storageState.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    // Aucune trace : tous les projets se connectent, et une trace enregistre les champs remplis (mot de
    // passe compris) ; Playwright ne sait pas les masquer.
    trace: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      // Scénarios propres au mobile (spec) : tag @mobile, exclus ici.
      grepInvert: /@mobile/,
      testIgnore: ACCOUNT_LOCALE_SPEC,
    },
    // Scénarios sans variante mobile (spec) : tag @desktop, exclus ici.
    // WebKit refuse les cookies __Secure- de Neon Auth sur http://localhost (plan socle, « e2e avec
    // connexion ») : en local, Chromium avec l'émulation iPhone ; WebKit contre une preview HTTPS.
    {
      name: "mobile",
      use: {
        ...devices["iPhone 15"],
        browserName: isLocal ? "chromium" : "webkit",
      },
      grepInvert: /@desktop/,
      testIgnore: ACCOUNT_LOCALE_SPEC,
    },
    // Changer de langue met le compte e2e partagé en anglais : ce parcours tourne seul, après tous les
    // autres (dependencies), une fois (ses deux largeurs sont fixées dans le fichier), en série.
    {
      name: "langue",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ACCOUNT_LOCALE_SPEC,
      dependencies: ["desktop", "mobile"],
      fullyParallel: false,
    },
  ],
  webServer: isLocal
    ? {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
