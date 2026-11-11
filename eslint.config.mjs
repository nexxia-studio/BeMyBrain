import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Frontières ADR-002 / ADR-008 : l'UI ne touche pas la base, les modules ne dépendent ni de React ni de Next.
// Rôle propriétaire (db/admin) et fabrique interne de withUserDb (db/user-db) : réservés à src/db, aux scripts et aux tests.
const privilegedDbImports = {
  group: ["@/db/admin", "**/db/admin", "@/db/user-db", "**/db/user-db"],
  message:
    "db/admin (rôle propriétaire) et db/user-db (fabrique interne) sont réservés aux scripts et à src/db : passer par withUserDb de @/db/client (ADR-002).",
};

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
          privilegedDbImports,
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
          privilegedDbImports,
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
