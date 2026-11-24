import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./session";

// Démo du kanban (BRAIN-46, demo-plan.md, D3) : la garde ferme la page sur tout build de production hors Vercel
// (`next start`), ouverte sous `pnpm dev`. Le mode du serveur se lit sur la CSP de notre proxy, qui
// n'autorise `'unsafe-eval'` que si `NODE_ENV === "development"`, la condition même de la garde
// (`src/lib/security-headers.ts`, `src/app/(app)/demo/kanban/demo-access.ts`).
// Preuve du 404 : lancer ce fichier seul contre `pnpm build && next start -p <port>` (E2E_BASE_URL) ; la
// suite courante, sous `pnpm dev`, vérifie l'autre branche (page ouverte). Hors périmètre : une preview
// Vercel (ouverte, en build de production) ; les e2e connectés n'y tournent pas (pas de compte e2e).
// raccourci: fichier retiré avec la démo, à la dernière tâche du plan todo-kanban.

test.use({ locale: "fr-FR" });

async function isDevelopmentServer(page: Page): Promise<boolean> {
  const response = await page.request.get("/login");
  const csp = response.headers()["content-security-policy"] ?? "";
  return csp.includes("'unsafe-eval'");
}

test("@desktop connecté, /demo/kanban répond 404 sur un build de production et s'ouvre sous pnpm dev", async ({
  page,
}) => {
  await signIn(page);
  const development = await isDevelopmentServer(page);

  const response = await page.goto("/demo/kanban");

  expect(response?.status()).toBe(development ? 200 : 404);
});
