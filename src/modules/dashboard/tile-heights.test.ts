import { describe, expect, it } from "vitest";

import {
  parseTileHeights,
  parseTileTier,
  recordTileHeights,
  TILE_HEIGHTS_COOKIE,
  TILE_HEIGHTS_MAX_LENGTH,
  tileHeightsCookie,
  tileHeightVars,
} from "./tile-heights";
import { buildDashboard } from "./tiles";

// Hauteurs mémorisées des tuiles (QA-6 d'effets-de-verre) : le cookie est une donnée non fiable (écrit par le
// navigateur, modifiable par n'importe qui). Rien n'en sort qui ne soit un identifiant de tuile connu et un entier
// borné ; aucune chaîne du cookie n'est recopiée dans un style.

const PX = /^\d+(\.\d{1,2})?px$/;

describe("lecture du cookie des hauteurs de tuiles", () => {
  it("lit un relevé valide : hauteurs en centièmes de pixel, par côté, palier et tuile", () => {
    const raw = "private.sm:today-31240_privateTodo-48000~pro.lg:proTodo-22050";

    const heights = parseTileHeights(raw);

    expect(heights).toEqual({
      private: { sm: { today: 31240, privateTodo: 48000 } },
      pro: { lg: { proTodo: 22050 } },
    });
  });

  it("pose les hauteurs du côté demandé en variables CSS, une par palier relevé", () => {
    const heights = parseTileHeights(
      "private.sm:today-31240~private.lg:today-28000~pro.md:today-50000",
    );

    expect(tileHeightVars(heights, "private", "today")).toEqual({
      "--tile-h-sm": "312.4px",
      "--tile-h-lg": "280px",
    });
    expect(tileHeightVars(heights, "pro", "today")).toEqual({
      "--tile-h-md": "500px",
    });
    expect(tileHeightVars(heights, "pro", "proTodo")).toEqual({});
  });

  it.each([
    ["absent", undefined],
    ["vide", ""],
    ["texte", "bonjour"],
    ["JSON cassé", '{"private":{"sm":{"today":312'],
    [
      "JSON valide mais d'un autre format",
      '{"private":{"sm":{"today":31240}}}',
    ],
  ])("cookie %s → aucun relevé", (_, raw) => {
    expect(parseTileHeights(raw)).toEqual({});
  });

  it.each([
    ["texte", "today-abc"],
    ["CSS (déclaration ajoutée)", "today-1px;background:url(https://x.test/a)"],
    ["CSS (unité)", "today-312px"],
    ["calc()", "today-calc(100vh)"],
    ["var()", "today-var(--x)"],
    ["négatif", "today--31240"],
    ["zéro", "today-0"],
    ["zéros en tête", "today-031240"],
    ["décimal", "today-312.40"],
    ["décimal à virgule", "today-312,4"],
    ["exposant", "today-3e4"],
    ["hexadécimal", "today-0x7a00"],
    ["sous la borne (79,99 px)", "today-7999"],
    ["au-dessus de la borne (1 200,01 px)", "today-120001"],
    ["nombre énorme", "today-99999999999999999999"],
    ["NaN", "today-NaN"],
    ["Infinity", "today-Infinity"],
    ["valeur vide", "today-"],
    ["espace", "today- 31240"],
    ["tuile inconnue", "garage-31240"],
    ["tuile de l'autre côté", "proTodo-31240"],
    ["clé de prototype", "__proto__-31240"],
    ["constructor", "constructor-31240"],
  ])("entrée hostile (%s) ignorée, les entrées valides gardées", (_, entry) => {
    const raw = `private.sm:${entry}_home-20000`;

    const heights = parseTileHeights(raw);

    expect(heights).toEqual({ private: { sm: { home: 20000 } } });
    expect(Object.getPrototypeOf({})).not.toHaveProperty("home");
  });

  it.each([
    ["côté inconnu", "famille.sm:today-31240"],
    ["palier inconnu", "private.xl:today-31240"],
    ["palier en majuscules", "private.SM:today-31240"],
    ["clé de prototype comme côté", "__proto__.sm:today-31240"],
    ["segment sans séparateur", "private.sm"],
  ])("segment hostile (%s) ignoré en entier", (_, segment) => {
    const raw = `${segment}~pro.md:today-30000`;

    expect(parseTileHeights(raw)).toEqual({ pro: { md: { today: 30000 } } });
  });

  it("cookie au-delà de 1 024 caractères ignoré en entier, même si son début est valide", () => {
    const valid = "private.sm:today-31240";
    const raw = `${valid}~${"x".repeat(TILE_HEIGHTS_MAX_LENGTH - valid.length)}`;

    expect(raw.length).toBe(TILE_HEIGHTS_MAX_LENGTH + 1);
    expect(parseTileHeights(raw)).toEqual({});
  });

  it("cookie de 1 024 caractères exactement encore lu", () => {
    const valid = "private.sm:today-31240";
    const raw = `${valid}~${"x".repeat(TILE_HEIGHTS_MAX_LENGTH - valid.length - 1)}`;

    expect(raw.length).toBe(TILE_HEIGHTS_MAX_LENGTH);
    expect(parseTileHeights(raw)).toEqual({
      private: { sm: { today: 31240 } },
    });
  });

  it("aucune chaîne du cookie dans un style : seules des longueurs en px formées à partir d'entiers bornés", () => {
    const raw =
      "private.sm:today-31240_home-1px;color:red_health-calc(1px)~private.md:today-120000~private.lg:today-8000";

    const vars = tileHeightVars(parseTileHeights(raw), "private", "today");

    expect(Object.keys(vars).sort()).toEqual([
      "--tile-h-lg",
      "--tile-h-md",
      "--tile-h-sm",
    ]);
    for (const value of Object.values(vars)) expect(value).toMatch(PX);
    expect(tileHeightVars(parseTileHeights(raw), "private", "home")).toEqual(
      {},
    );
    expect(tileHeightVars(parseTileHeights(raw), "private", "health")).toEqual(
      {},
    );
  });
});

describe("palier d'écran", () => {
  it.each(["sm", "md", "lg"])("palier %s reconnu", (tier) => {
    expect(parseTileTier(` ${tier} `)).toBe(tier);
  });

  it.each(["", "xl", "SM", "sm md", "toString"])(
    "palier « %s » refusé",
    (tier) => {
      expect(parseTileTier(tier)).toBeNull();
    },
  );
});

describe("écriture d'un relevé", () => {
  it("convertit les hauteurs mesurées en centièmes de pixel et n'écrit que le côté et le palier courants", () => {
    const previous =
      "private.sm:today-31240~private.lg:today-28000~pro.md:proTodo-40000";

    const value = recordTileHeights(previous, "private", "lg", {
      today: 290.40625,
      home: 180,
    });

    expect(parseTileHeights(value ?? "")).toEqual({
      private: {
        sm: { today: 31240 },
        lg: { today: 29041, home: 18000 },
      },
      pro: { md: { proTodo: 40000 } },
    });
  });

  it("le relevé du palier courant remplace l'ancien en entier (tuile disparue retirée)", () => {
    const previous = "private.sm:today-31240_health-20000";

    const value = recordTileHeights(previous, "private", "sm", {
      today: 300,
    });

    expect(parseTileHeights(value ?? "")).toEqual({
      private: { sm: { today: 30000 } },
    });
  });

  it("ignore les mesures hors bornes, non finies et les tuiles inconnues ou de l'autre côté", () => {
    const value = recordTileHeights(undefined, "pro", "md", {
      today: 0,
      proTodo: Number.NaN,
      clients: Number.POSITIVE_INFINITY,
      social: 1300,
      proFinances: 79.99,
      privateTodo: 300,
      garage: 300,
    });

    expect(value).toBeNull();
  });

  it("repart d'un ancien cookie hostile sans en recopier les entrées invalides", () => {
    const previous =
      "private.sm:today-1px;color:red~famille.sm:today-30000~private.md:home-20000";

    const value = recordTileHeights(previous, "private", "sm", {
      today: 300,
    });

    expect(value).toBe("private.sm:today-30000~private.md:home-20000");
  });

  it("deux côtés × trois paliers × toutes les tuiles aux hauteurs maximales : bien sous 1 024 caractères", () => {
    let value: string | null = null;
    const contexts = [{ id: "c", name: "C", color: "neutral" as const }];
    for (const side of ["private", "pro"] as const) {
      const ids = [
        "today",
        ...buildDashboard({ side, contexts, selected: [] }).tiles.map(
          (tile) => tile.id,
        ),
      ];
      for (const tier of ["sm", "md", "lg"] as const) {
        value = recordTileHeights(
          value ?? undefined,
          side,
          tier,
          Object.fromEntries(ids.map((id) => [id, 1199.99])),
        );
      }
    }

    expect(value).not.toBeNull();
    expect((value ?? "").length).toBeLessThan(TILE_HEIGHTS_MAX_LENGTH * 0.7);
    expect(
      Object.values(parseTileHeights(value ?? "")).flatMap((tiers) =>
        Object.values(tiers ?? {}),
      ),
    ).toHaveLength(6);
  });

  it("pose le cookie avec Path, Max-Age 30 jours, SameSite=Strict et Secure, sans HttpOnly", () => {
    const cookie = tileHeightsCookie("private.sm:today-31240", "/dashboard");

    expect(cookie.split("; ")).toEqual([
      `${TILE_HEIGHTS_COOKIE}=private.sm:today-31240`,
      "Path=/dashboard",
      `Max-Age=${60 * 60 * 24 * 30}`,
      "SameSite=Strict",
      "Secure",
    ]);
    expect(TILE_HEIGHTS_COOKIE).toBe("bmb-dashboard-tiles");
  });
});
