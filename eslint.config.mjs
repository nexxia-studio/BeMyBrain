import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Frontières ADR-002 / ADR-008 : l'UI ne touche pas la base, les modules ne dépendent ni de React ni de Next.
// Les modules n'accèdent à src/db que par @/db/client (withUserDb) et @/db/schema (tables) ;
// db/admin (rôle propriétaire) et db/user-db (fabrique interne) sont réservés à src/db, aux scripts et aux tests.
// Regex et non motifs gitignore : une négation (!@/db/client) ne ré-autorise pas un chemin dont le parent est exclu.
const relativeDbImports = {
  regex: "^\\.{1,2}/(?:.*/)?db(?:/.*)?$",
  message:
    "Import relatif vers src/db interdit : passer par l'alias @/db/... (ADR-002).",
};

const moduleDbImports = {
  regex: "^@/db(?:/(?!client$|schema(?:/[\\w-]+)?$).*)?$",
  message:
    "Les modules n'importent de src/db que @/db/client (withUserDb) et @/db/schema : db/admin et db/user-db sont réservés aux scripts et à src/db (ADR-002).",
};

const uiBoundaries = {
  files: ["src/app/**", "src/components/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "drizzle-orm",
              "drizzle-orm/*",
              "@/db",
              "@/db/*",
              "**/db",
              "**/db/*",
            ],
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
          relativeDbImports,
          moduleDbImports,
        ],
      },
    ],
  },
};

// src/lib (auth, session, préférences) ne requête pas la base : il passe par src/modules.
const libBoundaries = {
  files: ["src/lib/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["drizzle-orm", "drizzle-orm/*"],
            message:
              "Pas de requête Drizzle dans src/lib : passer par src/modules/<module>/ (ADR-002).",
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
  libBoundaries,
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
