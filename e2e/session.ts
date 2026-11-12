import { expect, type Page } from "@playwright/test";

import fr from "../messages/fr.json";

/** Compte Neon Auth de la branche visée (dev en local), jamais celui de la production. */
function credentials(): { email: string; password: string } {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL et E2E_USER_PASSWORD manquantes : compte e2e de la branche Neon visée (voir .env.example).",
    );
  }
  return { email, password };
}

/** Se connecte par l'écran de connexion (interface en français) et attend le tableau de bord. */
export async function signIn(page: Page): Promise<void> {
  const { email, password } = credentials();
  await page.goto("/login");
  await page.getByLabel(fr.auth.login.email).fill(email);
  await page.getByLabel(fr.auth.login.password).fill(password);
  await page.getByRole("button", { name: fr.auth.login.submit }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
