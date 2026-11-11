import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Frontières ADR-002 / ADR-008 : l'UI ne touche pas la base, les modules ne dépendent ni de React ni de Next.
// Partout dans src/ hors src/db : ni db/admin (rôle propriétaire), ni db/user-db (fabrique interne),
// ni db/migration-env (URL propriétaire), ni pilote Neon. Les modules n'accèdent à src/db que par
// @/db/client (withUserDb) et @/db/schema (tables).
// Regex et non motifs gitignore : une négation (!@/db/client) ne ré-autorise pas un chemin dont le parent est exclu.
// Dans un même fichier, la dernière config qui pose une règle remplace les précédentes :
// chaque config spécifique reprend donc les motifs communs.
const privilegedDbImports = {
  regex:
    "(?:^|/)db/(?:.*/)?(?:admin|user-db|migration-env)(?:\\.[cm]?[jt]sx?)?$",
  message:
    "db/admin, db/user-db et db/migration-env sont réservés à src/db, aux scripts et aux tests : passer par withUserDb de @/db/client (ADR-002).",
};

const neonDriverImports = {
  group: ["@neondatabase/serverless", "drizzle-orm/neon-*"],
  message:
    "Le pilote Neon ne s'ouvre que dans src/db : passer par withUserDb de @/db/client (ADR-002).",
};

const commonPatterns = [privilegedDbImports, neonDriverImports];

const relativeDbImports = {
  regex: "^\\.{1,2}/(?:.*/)?db(?:/.*)?$",
  message:
    "Import relatif vers src/db interdit : passer par l'alias @/db/... (ADR-002).",
};

const moduleDbImports = {
  regex: "^@/db(?:/(?!client$|schema(?:/[\\w-]+)?$).*)?$",
  message:
    "Les modules n'importent de src/db que @/db/client (withUserDb) et @/db/schema (ADR-002).",
};

// Sélecteurs esquery : une regex esquery ne peut pas contenir « / », d'où /.
const DB_SOURCE = "/(^|\\u002F)db(\\u002F|$)/";

const dynamicDbImport = {
  selector: `ImportExpression[source.value=${DB_SOURCE}]`,
  message: "Import dynamique de src/db interdit hors de src/db (ADR-002).",
};

const databaseUrlMessage =
  "DATABASE_URL (rôle propriétaire) ne se lit que dans src/db/migration-env.ts (ADR-002).";
const processEnvDatabaseUrl = [
  {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='DATABASE_URL']",
    message: databaseUrlMessage,
  },
  {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env'][property.value='DATABASE_URL']",
    message: databaseUrlMessage,
  },
  {
    selector:
      "VariableDeclarator[init.object.name='process'][init.property.name='env'] > ObjectPattern > Property[key.name='DATABASE_URL']",
    message: databaseUrlMessage,
  },
];

const commonSyntax = [dynamicDbImport, ...processEnvDatabaseUrl];

const srcBoundaries = {
  files: ["src/**"],
  ignores: ["src/db/**"],
  rules: {
    "no-restricted-imports": ["error", { patterns: commonPatterns }],
    "no-restricted-syntax": ["error", ...commonSyntax],
  },
};

const dbBoundaries = {
  files: ["src/db/**"],
  ignores: ["src/db/migration-env.ts"],
  rules: {
    "no-restricted-syntax": ["error", ...processEnvDatabaseUrl],
  },
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
          ...commonPatterns,
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
          ...commonPatterns,
        ],
      },
    ],
  },
};

// src/lib (auth, session, préférences) ne requête pas la base et ne la ré-exporte pas : il passe par src/modules.
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
          ...commonPatterns,
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      ...commonSyntax,
      {
        selector: `ExportNamedDeclaration[source.value=${DB_SOURCE}]`,
        message: "Pas de ré-export de src/db depuis src/lib (ADR-002).",
      },
      {
        selector: `ExportAllDeclaration[source.value=${DB_SOURCE}]`,
        message: "Pas de ré-export de src/db depuis src/lib (ADR-002).",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  srcBoundaries,
  dbBoundaries,
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
