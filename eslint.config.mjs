import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Frontières ADR-002 / ADR-008 : l'UI ne touche pas la base, les modules ne dépendent ni de React ni de Next.
// Partout dans src/ hors src/db : ni db/admin (rôle propriétaire), ni db/user-db (fabrique interne),
// ni db/migration-env (URL propriétaire), ni pilote (Neon, pg, postgres), ni sous-chemin de drizzle-orm
// (pg-core et pilotes réservés à src/db ; les modules n'utilisent que les opérateurs de « drizzle-orm »).
// Les modules n'accèdent à src/db que par @/db/client (withUserDb) et @/db/schema (tables).
// Regex et non motifs gitignore : une négation (!@/db/client) ne ré-autorise pas un chemin dont le parent est exclu.
// Dans un même fichier, la dernière config qui pose une règle remplace les précédentes :
// chaque config passe donc par restrictedImports() / restrictedSyntax(), qui reprennent le socle commun.
const privilegedDbImports = {
  regex:
    "(?:^|/)db/(?:.*/)?(?:admin|user-db|migration-env)(?:\\.[cm]?[jt]sx?)?$",
  message:
    "db/admin, db/user-db et db/migration-env sont réservés à src/db, aux scripts et aux tests : passer par withUserDb de @/db/client (ADR-002).",
};

const driverImports = {
  group: [
    "@neondatabase/*",
    "pg",
    "pg/*",
    "postgres",
    "postgres/*",
    "drizzle-orm/*",
  ],
  message:
    "Pilotes de base et sous-chemins de drizzle-orm réservés à src/db : passer par withUserDb de @/db/client (ADR-002).",
};

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

const processImportMessage =
  "Lire l'environnement via @/env, pas via le module process (ADR-002).";
const processImports = [
  { name: "process", message: processImportMessage },
  { name: "node:process", message: processImportMessage },
];

const restrictedImports = (...patterns) => [
  "error",
  {
    paths: processImports,
    patterns: [...patterns, privilegedDbImports, driverImports],
  },
];

// Sélecteurs esquery : une regex esquery ne peut pas contenir « / », d'où /.
const DB_SOURCE = "/(^|\\u002F)db(\\u002F|$)/";

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

const commonSyntax = [
  ...processEnvDatabaseUrl,
  {
    selector:
      "MemberExpression[computed=true][object.object.name='process'][object.property.name='env'][property.type!='Literal']",
    message:
      "process.env[<expression>] interdit : nommer la variable, et la lire via @/env (ADR-002).",
  },
  {
    selector:
      "MemberExpression[object.name=/^(globalThis|global)$/][property.name='process']",
    message:
      "globalThis.process interdit : lire l'environnement via @/env (ADR-002).",
  },
  {
    selector: "ImportExpression[source.type!='Literal']",
    message:
      "Import dynamique à source calculée interdit : écrire le chemin en littéral (ADR-002).",
  },
  {
    selector: `ImportExpression[source.value=${DB_SOURCE}]`,
    message: "Import dynamique de src/db interdit hors de src/db (ADR-002).",
  },
  {
    selector: `CallExpression[callee.name='require'][arguments.0.value=${DB_SOURCE}]`,
    message: "require() de src/db interdit hors de src/db (ADR-002).",
  },
];

// Helpers de test (tests/factories : withUserDb sans vérification de jeton, pools propriétaires) :
// interdits au code de prod de src/, relatif ou par alias. Les *.test.ts{x} de src/ les gardent (testFileSyntax).
const TESTS_SOURCE = "/(^|\\u002F)tests(\\u002F|$)/";
const testsImportMessage =
  "Les helpers de tests/ sont réservés aux fichiers *.test.ts : le code de prod ne les importe pas.";
const testsImportSyntax = [
  `ImportDeclaration[source.value=${TESTS_SOURCE}]`,
  `ExportNamedDeclaration[source.value=${TESTS_SOURCE}]`,
  `ExportAllDeclaration[source.value=${TESTS_SOURCE}]`,
  `ImportExpression[source.value=${TESTS_SOURCE}]`,
  `CallExpression[callee.name='require'][arguments.0.value=${TESTS_SOURCE}]`,
].map((selector) => ({ selector, message: testsImportMessage }));

const restrictedSyntax = (...extra) => [
  "error",
  ...commonSyntax,
  ...testsImportSyntax,
  ...extra,
];

const srcBoundaries = {
  files: ["src/**"],
  ignores: ["src/db/**"],
  rules: {
    "no-restricted-imports": restrictedImports(),
    "no-restricted-syntax": restrictedSyntax(),
  },
};

const dbBoundaries = {
  files: ["src/db/**"],
  ignores: ["src/db/migration-env.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      ...processEnvDatabaseUrl,
      ...testsImportSyntax,
    ],
  },
};

// migration-env.ts lit DATABASE_URL (exempté ci-dessus) mais n'importe pas plus les helpers de tests/.
const migrationEnvBoundaries = {
  files: ["src/db/migration-env.ts"],
  rules: {
    "no-restricted-syntax": ["error", ...testsImportSyntax],
  },
};

const uiBoundaries = {
  files: ["src/app/**", "src/components/**"],
  rules: {
    "no-restricted-imports": restrictedImports({
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
    }),
  },
};

const moduleBoundaries = {
  files: ["src/modules/**"],
  rules: {
    "no-restricted-imports": restrictedImports(
      {
        group: ["react", "react-dom", "react-dom/*", "next", "next/*"],
        message: "Les modules métier n'importent ni React ni Next (ADR-008).",
      },
      relativeDbImports,
      moduleDbImports,
    ),
  },
};

const libReexportSyntax = [
  {
    selector: `ExportNamedDeclaration[source.value=${DB_SOURCE}]`,
    message: "Pas de ré-export de src/db depuis src/lib (ADR-002).",
  },
  {
    selector: `ExportAllDeclaration[source.value=${DB_SOURCE}]`,
    message: "Pas de ré-export de src/db depuis src/lib (ADR-002).",
  },
];

// src/lib (auth, session, préférences) ne touche pas la base et ne la ré-exporte pas : il passe par src/modules.
const libBoundaries = {
  files: ["src/lib/**"],
  rules: {
    "no-restricted-imports": restrictedImports(
      {
        group: ["drizzle-orm", "drizzle-orm/*", "@/db", "@/db/*"],
        message:
          "Pas d'accès base dans src/lib : passer par src/modules/<module>/ (ADR-002).",
      },
      relativeDbImports,
    ),
    "no-restricted-syntax": restrictedSyntax(...libReexportSyntax),
  },
};

// Fichiers de test de src/ : mêmes règles de syntaxe, sauf l'interdiction des helpers de tests/.
// Placé après les autres configs (la dernière qui pose une règle l'emporte).
const TEST_FILES = ["src/**/*.test.ts", "src/**/*.test.tsx"];
const testFileSyntax = [
  {
    files: TEST_FILES,
    ignores: ["src/db/**", "src/lib/**"],
    rules: { "no-restricted-syntax": ["error", ...commonSyntax] },
  },
  {
    files: TEST_FILES.map((glob) => glob.replace("src/", "src/lib/")),
    rules: {
      "no-restricted-syntax": ["error", ...commonSyntax, ...libReexportSyntax],
    },
  },
  {
    files: TEST_FILES.map((glob) => glob.replace("src/", "src/db/")),
    rules: { "no-restricted-syntax": ["error", ...processEnvDatabaseUrl] },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  srcBoundaries,
  dbBoundaries,
  migrationEnvBoundaries,
  uiBoundaries,
  moduleBoundaries,
  libBoundaries,
  ...testFileSyntax,
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
