import { defineConfig, devices } from "@playwright/test";

// Identifiants du compte e2e (E2E_USER_EMAIL, E2E_USER_PASSWORD) : .env en local, absent en CI.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// Local par défaut ; E2E_BASE_URL vise une preview HTTPS (sans serveur local).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isLocal = new URL(baseURL).protocol === "http:";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
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
