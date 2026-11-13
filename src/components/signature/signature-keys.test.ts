import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BENTO_REVEAL_SIGNATURE_KEY,
  DASHBOARD_INTRO_SIGNATURE_KEY,
  EMPTY_STATE_SIGNATURE_KEY,
  isSignaturePending,
  isTilesFadePending,
  markSignaturePlayed,
  prehidePendingMoments,
  releasePrehide,
  SIDE_SWITCH_SIGNATURE_KEY,
  SIDE_SWITCH_TILES_SIGNATURE_KEY,
  SIGNATURE_PENDING_ATTRIBUTE,
  signaturePrehideScript,
} from "./signature-keys";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce ? query.includes(": reduce") : false,
    media: query,
  }));
}

// Deux chemins, même comportement : script en ligne (chargement complet de la page, avant l'hydratation)
// et fonction appelée par BentoGrid avant peinture (navigation côté client, où un script en ligne
// inséré par React ne s'exécute pas).
const PREHIDE_PATHS = [
  ["script en ligne", () => new Function(signaturePrehideScript())()],
  ["navigation côté client", () => prehidePendingMoments()],
] as const;

const html = () => document.documentElement;

beforeEach(() => {
  sessionStorage.clear();
  html().removeAttribute(SIGNATURE_PENDING_ATTRIBUTE);
  stubReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each(PREHIDE_PATHS)(
  "masquage avant l'entrée du tableau de bord (%s)",
  (_path, runPrehideScript) => {
    it("à la première visite de la session, masque l'entrée, la grille et les écrans vides", () => {
      runPrehideScript();

      expect(html().getAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(
        "intro reveal empty",
      );
    });

    it("ne masque que les moments pas encore joués", () => {
      markSignaturePlayed(DASHBOARD_INTRO_SIGNATURE_KEY);
      markSignaturePlayed(EMPTY_STATE_SIGNATURE_KEY);

      runPrehideScript();

      expect(html().getAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe("reveal");
    });

    it("ne masque rien quand tout a déjà été joué dans la session", () => {
      for (const key of [
        DASHBOARD_INTRO_SIGNATURE_KEY,
        BENTO_REVEAL_SIGNATURE_KEY,
        EMPTY_STATE_SIGNATURE_KEY,
      ]) {
        markSignaturePlayed(key);
      }

      runPrehideScript();

      expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
    });

    it("ne masque rien quand le système demande moins de mouvement", () => {
      stubReducedMotion(true);

      runPrehideScript();

      expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
    });

    it("démasque tout seul si GSAP ne se charge pas", () => {
      vi.useFakeTimers();
      runPrehideScript();

      vi.advanceTimersByTime(3000);

      expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
    });

    it("un moment joué ne démasque que ses propres éléments", () => {
      runPrehideScript();

      releasePrehide("intro");

      expect(html().getAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(
        "reveal empty",
      );
    });

    it("le dernier moment joué retire l'attribut", () => {
      html().setAttribute(SIGNATURE_PENDING_ATTRIBUTE, "empty");

      releasePrehide("empty");

      expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
    });
  },
);

describe("fondu des tuiles à la première bascule", () => {
  it("reste à jouer tant que la pilule n'a pas glissé", () => {
    expect(isTilesFadePending()).toBe(true);
  });

  it("est consommé si la première bascule a eu lieu avant l'affichage de la grille", () => {
    markSignaturePlayed(SIDE_SWITCH_SIGNATURE_KEY);

    const pending = isTilesFadePending();

    expect(pending).toBe(false);
    expect(
      sessionStorage.getItem(SIDE_SWITCH_TILES_SIGNATURE_KEY),
    ).not.toBeNull();
  });
});

describe("stockage de session indisponible (SecurityError)", () => {
  function blockStorage() {
    const denied = () => {
      throw new DOMException("refusé", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("considère chaque moment comme déjà joué", () => {
    blockStorage();

    expect(isSignaturePending(DASHBOARD_INTRO_SIGNATURE_KEY)).toBe(false);
  });

  it("marquer un moment joué ne lève pas", () => {
    blockStorage();

    expect(() =>
      markSignaturePlayed(DASHBOARD_INTRO_SIGNATURE_KEY),
    ).not.toThrow();
  });

  it("le fondu des tuiles n'est pas à jouer et ne lève pas", () => {
    blockStorage();

    expect(isTilesFadePending()).toBe(false);
  });

  it.each(PREHIDE_PATHS)("rien n'est masqué (%s)", (_path, prehide) => {
    blockStorage();

    prehide();

    expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
  });
});

describe("minuteurs de masquage concurrents", () => {
  it("le minuteur du script en ligne ne retire pas un masquage reposé ensuite (connexion rapide)", () => {
    vi.useFakeTimers();
    new Function(signaturePrehideScript())();
    vi.advanceTimersByTime(2000);
    prehidePendingMoments();

    vi.advanceTimersByTime(1500);

    expect(html().getAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(
      "intro reveal empty",
    );
  });

  it("le masquage reposé retombe tout seul après son propre délai", () => {
    vi.useFakeTimers();
    new Function(signaturePrehideScript())();
    vi.advanceTimersByTime(2000);
    prehidePendingMoments();

    vi.advanceTimersByTime(3000);

    expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
  });

  it("l'annulation (démontage de la grille) coupe le minuteur et démasque", () => {
    vi.useFakeTimers();
    const cancel = prehidePendingMoments();

    cancel();

    expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("une annulation tardive ne démasque pas un masquage plus récent", () => {
    vi.useFakeTimers();
    const cancelFirst = prehidePendingMoments();
    prehidePendingMoments();

    cancelFirst();

    expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(true);
  });
});
