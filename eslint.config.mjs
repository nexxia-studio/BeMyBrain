import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Frontières ADR-002 / ADR-008 : l'UI ne touche pas la base, les modules ne dépendent ni de React ni de Next.
const uiBoundaries = {
  files: ["src/app/**", "src/components/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["drizzle-orm", "drizzle-orm/*", "@/db", "@/db/*"],
            message:
              "Pas d'accès base depuis l'UI : passer par src/modules/<module>/ (ADR-002).",
          },
        ],
      },
    ],
  },
};

const moduleBoundaries = {
  files: ["src/modules/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["react", "react-dom", "react-dom/*", "next", "next/*"],
            message:
              "Les modules métier n'importent ni React ni Next (ADR-008).",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  uiBoundaries,
  moduleBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
