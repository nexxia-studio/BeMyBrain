import type { Page } from "@playwright/test";

/**
 * Relève toute violation de la CSP sur la page (événement du navigateur et message de console).
 * À appeler avant la première navigation ; lire le tableau renvoyé en fin de test.
 */
export async function watchCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction("__reportCspViolation", (message: string) => {
    violations.push(message);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (
        window as unknown as { __reportCspViolation: (m: string) => void }
      ).__reportCspViolation(
        `${event.violatedDirective} ${event.blockedURI || "inline"}`,
      );
    });
  });
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
}
