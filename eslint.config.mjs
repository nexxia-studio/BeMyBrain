import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Frontières ADR-002 / ADR-008 : l'UI ne touche pas la base, les modules ne dépendent ni de React ni de Next.
// Partout dans src/ hors src/db : ni db/admin (rôle propriétaire), ni db/user-db (fabrique interne),
// ni db/migration-env (URL propriétaire), ni db/pool (pool brut), ni pilote (Neon, pg, postgres), ni sous-chemin de drizzle-orm
// (pg-core et pilotes réservés à src/db ; les modules n'utilisent que les opérateurs de « drizzle-orm »).
// Les modules n'accèdent à src/db que par @/db/client (withUserDb) et @/db/schema (tables).
// Regex et non motifs gitignore : une négation (!@/db/client) ne ré-autorise pas un chemin dont le parent est exclu.
// Dans un même fichier, la dernière config qui pose une règle remplace les précédentes :
// chaque config passe donc par restrictedImports() / restrictedSyntax(), qui reprennent le socle commun.
const privilegedDbImports = {
  regex:
    "(?:^|/)db/(?:.*/)?(?:admin|user-db|migration-env|pool)(?:\\.[cm]?[jt]sx?)?$",
  message:
    "db/admin, db/user-db, db/migration-env et db/pool (pool brut, sans RLS) sont réservés à src/db, aux scripts et aux tests : passer par withUserDb de @/db/client (ADR-002).",
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

// Glisser-déposer (démo kanban, BRAIN-46) : dnd-kit n'entre que par SortableBoard.tsx et AisleSortable.tsx (listes, tâche 14), tests compris.
// Imports statiques (dndKitImports) et chemins détournés (dndKitSyntax : import(), require, typeof import(),
// vi.mock & co). Posé sur tout le dépôt (dndKitEverywhere), repris par chaque config de src qui pose la règle
// (socles importSocle et syntaxSocle + dnd-kit), levé pour ce seul fichier en dernier (sortableBoardBoundaries).
// Contournements délibérés non couverts (verrou de relecture, pas une barrière) : gabarit de chaîne dans import()
// dans tests/, e2e/, scripts/ et src/db/ (ailleurs dans src/, commonSyntax refuse déjà toute source non
// littérale) ; `vi` renommé (`const v = vi; v.mock(...)`) ou importé sous un autre nom.
const SORTABLE_BOARD = "src/components/kanban/SortableBoard.tsx";
const AISLE_SORTABLE = "src/components/shopping/AisleSortable.tsx";
const dndKitMessage =
  "dnd-kit est réservé à src/components/kanban/SortableBoard.tsx et src/components/shopping/AisleSortable.tsx : passer par ces composants.";
const dndKitImports = {
  group: ["@dnd-kit", "@dnd-kit/*"],
  message: dndKitMessage,
};

const restrictedImportsOver =
  (socle) =>
  (...patterns) => [
    "error",
    { paths: processImports, patterns: [...patterns, ...socle] },
  ];
const importSocle = [privilegedDbImports, driverImports];
const restrictedImports = restrictedImportsOver([
  ...importSocle,
  dndKitImports,
]);

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

// Registre d'actions (ADR-009) : seul src/modules/actions/run.ts l'exécute, avec le canal et le contexte de la
// session ; un autre fichier qui l'importerait contournerait ce point d'entrée. Les tests le gardent.
const importSyntaxFor = (source, message) =>
  [
    `ImportDeclaration[source.value=${source}]`,
    `ExportNamedDeclaration[source.value=${source}]`,
    `ExportAllDeclaration[source.value=${source}]`,
    `ImportExpression[source.value=${source}]`,
    `CallExpression[callee.name='require'][arguments.0.value=${source}]`,
  ].map((selector) => ({ selector, message }));
const registryImportMessage =
  "Le registre d'actions est réservé à src/modules/actions/run.ts (et aux tests) : passer par runActionWithToken (ADR-009).";
const registryImportSyntax = importSyntaxFor(
  "/(^|\\u002F)actions\\u002Fregistry(\\.[cm]?[jt]sx?)?$/",
  registryImportMessage,
);
// Dans src/modules/actions, l'import relatif « ./registry ».
const localRegistryImportSyntax = importSyntaxFor(
  "/^\\.\\u002Fregistry(\\.[cm]?[jt]sx?)?$/",
  registryImportMessage,
);

// Sélecteurs dnd-kit (voir dndKitImports) : les formes de importSyntaxFor, plus le type importé et les mocks
// de Vitest, qui chargent le module sans passer par no-restricted-imports.
const DND_KIT_SOURCE = "/^@dnd-kit(\\u002F|$)/";
const dndKitSyntax = [
  ...importSyntaxFor(DND_KIT_SOURCE, dndKitMessage),
  ...[
    `TSImportType[argument.literal.value=${DND_KIT_SOURCE}]`,
    `CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock|unmock|doUnmock|importActual|importMock)$/][arguments.0.value=${DND_KIT_SOURCE}]`,
  ].map((selector) => ({ selector, message: dndKitMessage })),
];

// createRequire (et le module « module » qui le fournit) charge n'importe quel chemin sans passer par
// no-restricted-imports ni par les sélecteurs require/import ci-dessus : interdit dans tout src/, src/db compris.
// Les fichiers de test de src/ le gardent (testFileSyntax, sans ces sélecteurs).
const createRequireMessage =
  "createRequire (module « module ») interdit dans src/ : il contourne les frontières d'import (ADR-002).";
const createRequireSyntax = [
  {
    selector: "Identifier[name='createRequire']",
    message: createRequireMessage,
  },
  ...importSyntaxFor("/^(node:)?module$/", createRequireMessage),
];

const syntaxSocle = [
  ...commonSyntax,
  ...testsImportSyntax,
  ...registryImportSyntax,
  ...createRequireSyntax,
];
const restrictedSyntax = (...extra) => [
  "error",
  ...syntaxSocle,
  ...dndKitSyntax,
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
      ...registryImportSyntax,
      ...createRequireSyntax,
      ...dndKitSyntax,
    ],
  },
};

// migration-env.ts lit DATABASE_URL (exempté ci-dessus) mais n'importe pas plus les helpers de tests/.
const migrationEnvBoundaries = {
  files: ["src/db/migration-env.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      ...testsImportSyntax,
      ...createRequireSyntax,
      ...dndKitSyntax,
    ],
  },
};

const uiPatterns = [
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
];

const uiBoundaries = {
  files: ["src/app/**", "src/components/**"],
  rules: {
    "no-restricted-imports": restrictedImports(...uiPatterns),
  },
};

// Tout le dépôt (tests/, e2e/, scripts/ compris) ; les configs de src/ qui suivent le reprennent.
const dndKitEverywhere = {
  files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
  rules: {
    "no-restricted-imports": ["error", { patterns: [dndKitImports] }],
    "no-restricted-syntax": ["error", ...dndKitSyntax],
  },
};

// Seules exceptions (le tableau kanban, l'ordre des rayons de Courses) : mêmes socles que src/components (srcBoundaries, uiBoundaries), sans dnd-kit.
// Placé en dernier (la dernière config l'emporte).
const sortableBoardBoundaries = {
  files: [SORTABLE_BOARD, AISLE_SORTABLE],
  rules: {
    "no-restricted-imports": restrictedImportsOver(importSocle)(...uiPatterns),
    "no-restricted-syntax": ["error", ...syntaxSocle],
  },
};

const modulePatterns = [
  {
    group: ["react", "react-dom", "react-dom/*", "next", "next/*"],
    message: "Les modules métier n'importent ni React ni Next (ADR-008).",
  },
  relativeDbImports,
  moduleDbImports,
];

const moduleBoundaries = {
  files: ["src/modules/**"],
  rules: {
    "no-restricted-imports": restrictedImports(...modulePatterns),
  },
};

// Déclarations d'actions (src/modules/<module>/actions.ts) : `run` n'appelle que les fonctions du module
// (queries.ts, mutations.ts), jamais une requête écrite sur place (ADR-009, ADR-004).
const moduleActionsBoundaries = {
  files: ["src/modules/*/actions.ts"],
  rules: {
    "no-restricted-imports": restrictedImports(...modulePatterns, {
      group: ["drizzle-orm", "drizzle-orm/*", "@/db/schema", "@/db/schema/*"],
      message:
        "Une action n'appelle que les fonctions de son module (queries.ts, mutations.ts) : ni drizzle-orm ni @/db/schema (ADR-009).",
    }),
  },
};

// src/modules/actions : « ./registry » interdit aussi, sauf dans run.ts, seul point d'entrée du registre.
const actionsModuleSyntax = [
  {
    files: ["src/modules/actions/**"],
    ignores: ["src/modules/actions/run.ts"],
    rules: {
      "no-restricted-syntax": restrictedSyntax(...localRegistryImportSyntax),
    },
  },
  {
    files: ["src/modules/actions/run.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...commonSyntax,
        ...testsImportSyntax,
        ...createRequireSyntax,
        ...dndKitSyntax,
      ],
    },
  },
];

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
    rules: {
      "no-restricted-syntax": ["error", ...commonSyntax, ...dndKitSyntax],
    },
  },
  {
    files: TEST_FILES.map((glob) => glob.replace("src/", "src/lib/")),
    rules: {
      "no-restricted-syntax": [
        "error",
        ...commonSyntax,
        ...libReexportSyntax,
        ...dndKitSyntax,
      ],
    },
  },
  {
    files: TEST_FILES.map((glob) => glob.replace("src/", "src/db/")),
    rules: {
      "no-restricted-syntax": [
        "error",
        ...processEnvDatabaseUrl,
        ...dndKitSyntax,
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  dndKitEverywhere,
  srcBoundaries,
  dbBoundaries,
  migrationEnvBoundaries,
  uiBoundaries,
  moduleBoundaries,
  moduleActionsBoundaries,
  ...actionsModuleSyntax,
  libBoundaries,
  ...testFileSyntax,
  sortableBoardBoundaries,
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
