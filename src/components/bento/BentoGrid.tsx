"use client";

// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Grille bento (DESIGN.md § 6) : rangées flex-wrap, une colonne à 390 px (sauf la paire de tuiles
// chiffre), deux tuiles standard par rangée sur tablette, 2 à 3 par rangée sur ordinateur.
// Charge à la demande (next/dynamic, sans rendu serveur) les moments signature GSAP du tableau de bord :
// entrée, révélation de la grille, écrans vides, fondu des tuiles à la première bascule. GSAP reste hors
// du bundle initial.
import dynamic from "next/dynamic";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  BENTO_REVEAL_SIGNATURE_KEY,
  DASHBOARD_INTRO_SIGNATURE_KEY,
  EMPTY_STATE_SIGNATURE_KEY,
  isSignaturePending,
  isTilesFadePending,
  prehidePendingMoments,
  SIDE_SWITCH_TILES_SIGNATURE_KEY,
} from "@/components/signature/signature-keys";
import type { Side } from "@/modules/core/schemas";

const DashboardIntroSignature = dynamic(
  () =>
    import("@/components/signature/dashboard-intro").then(
      (m) => m.DashboardIntroSignature,
    ),
  { ssr: false },
);
const BentoRevealSignature = dynamic(
  () =>
    import("@/components/signature/bento-reveal").then(
      (m) => m.BentoRevealSignature,
    ),
  { ssr: false },
);
const EmptyStateSignature = dynamic(
  () =>
    import("@/components/signature/empty-state").then(
      (m) => m.EmptyStateSignature,
    ),
  { ssr: false },
);
const SideSwitchTilesSignature = dynamic(
  () =>
    import("@/components/signature/side-switch-tiles").then(
      (m) => m.SideSwitchTilesSignature,
    ),
  { ssr: false },
);

const ENTRANCE_KEYS = [
  DASHBOARD_INTRO_SIGNATURE_KEY,
  BENTO_REVEAL_SIGNATURE_KEY,
  EMPTY_STATE_SIGNATURE_KEY,
];

// Décision figée au premier rendu client du document : un moment qui se marque « joué » ne doit pas
// démonter son composant (et annuler son animation) au rendu suivant. Chaque moment revérifie son
// marqueur avant de jouer : un composant chargé pour rien ne joue rien.
let entranceAtLoad: boolean | undefined;
let tilesFadeAtLoad: boolean | undefined;
const readEntrance = () =>
  (entranceAtLoad ??= ENTRANCE_KEYS.some(isSignaturePending));
const readTilesFade = () =>
  (tilesFadeAtLoad ??= isSignaturePending(SIDE_SWITCH_TILES_SIGNATURE_KEY));
const noSubscription = () => () => {};
// Au rendu serveur, rien n'est chargé : la décision se prend à l'hydratation.
const nothingOnServer = () => false;

type BentoGridProps = {
  /** Côté affiché, lu dans le cookie par le serveur. */
  side: Side;
  children: React.ReactNode;
};

export function BentoGrid({ side, children }: BentoGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Côté au montage : le fondu, chargé après l'hydratation, s'y compare pour voir aussi une bascule
  // arrivée avant son chargement.
  const [initialSide] = useState(side);
  const entrance = useSyncExternalStore(
    noSubscription,
    readEntrance,
    nothingOnServer,
  );
  const tilesFade = useSyncExternalStore(
    noSubscription,
    readTilesFade,
    nothingOnServer,
  );

  // Avant la peinture : masque les cibles des moments en attente. Au chargement complet, le script en
  // ligne de la page l'a déjà fait ; après une navigation côté client (connexion), c'est ici.
  useLayoutEffect(() => {
    prehidePendingMoments();
  }, []);

  // Au montage, avant tout geste : si la pilule a déjà glissé dans la session, le fondu est consommé.
  useEffect(() => {
    isTilesFadePending();
  }, []);

  return (
    <div ref={rootRef} className="flex flex-wrap gap-grid">
      {children}
      {entrance ? (
        <>
          <DashboardIntroSignature rootRef={rootRef} />
          <BentoRevealSignature rootRef={rootRef} />
          <EmptyStateSignature rootRef={rootRef} />
        </>
      ) : null}
      {tilesFade ? (
        <SideSwitchTilesSignature
          rootRef={rootRef}
          initialSide={initialSide}
          side={side}
        />
      ) : null}
    </div>
  );
}
