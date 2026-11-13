"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Pilule de bascule Privé / Pro (DESIGN.md § 5). La pilule blanche (`thumb`) partage la cellule de
// grille du bouton actif : elle change de colonne instantanément. Seul le moment signature (GSAP,
// première bascule de la session) la fait glisser ; Motion n'anime que la pression des boutons.
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRef, useState, useSyncExternalStore } from "react";

import {
  isSignaturePending,
  SIDE_SWITCH_SIGNATURE_KEY,
} from "@/components/signature/signature-keys";
import { setSide } from "@/lib/preferences-actions";
import { cn } from "@/lib/utils";
import { sides, type Side } from "@/modules/core/sides";

import { PreferenceStatus } from "./PreferenceStatus";
import { useOptimisticPreference } from "./use-optimistic-preference";

const SideSwitchSignature = dynamic(
  () =>
    import("@/components/signature/side-switch").then(
      (m) => m.SideSwitchSignature,
    ),
  { ssr: false },
);

const noSubscription = () => () => {};
const readPending = () => isSignaturePending(SIDE_SWITCH_SIGNATURE_KEY);
// Au rendu serveur, rien n'est chargé : la décision se prend à l'hydratation.
const readPendingOnServer = () => false;

const COLUMN: Record<Side, string> = {
  private: "col-start-1",
  pro: "col-start-2",
};

type SideSwitchProps = {
  /** Côté lu dans le cookie bmb_side par le serveur. */
  side: Side;
};

export function SideSwitch({ side }: SideSwitchProps) {
  const t = useTranslations("shell.side");
  const {
    shown: shownSide,
    pending,
    failed,
    update,
  } = useOptimisticPreference(side, setSide);
  // Côté au montage : le moment signature, chargé après l'hydratation, s'y compare pour voir aussi une
  // bascule faite avant son chargement.
  const [initialSide] = useState(side);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const signaturePending = useSyncExternalStore(
    noSubscription,
    readPending,
    readPendingOnServer,
  );

  function choose(next: Side) {
    if (next === shownSide) return;
    update(next);
  }

  // Sous 1024 px, la pilule est posée sur du verre : sur le fond nu, le halo bleu fait tomber le texte
  // inactif sous 4,5:1 (DESIGN.md § 8, décision 6, mesuré sur capture). Au-dessus, l'en-tête est déjà
  // en verre (jamais deux verres empilés).
  return (
    <div className="relative rounded-full max-lg:glass">
      <div
        role="group"
        aria-label={t("label")}
        aria-busy={pending}
        className="grid grid-cols-2 gap-1 rounded-full bg-pill-track p-1"
      >
        <span
          ref={thumbRef}
          aria-hidden="true"
          className={cn(
            "row-start-1 rounded-full bg-pill-active shadow-raised",
            COLUMN[shownSide],
          )}
        />
        {sides.map((value) => {
          const active = value === shownSide;
          return (
            <motion.button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(value)}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className={cn(
                "relative row-start-1 min-h-11 rounded-full px-4.5 text-body font-semibold lg:px-5.5",
                COLUMN[value],
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(value)}
            </motion.button>
          );
        })}
        {signaturePending ? (
          <SideSwitchSignature
            thumbRef={thumbRef}
            initialSide={initialSide}
            side={shownSide}
          />
        ) : null}
      </div>
      <PreferenceStatus failed={failed} className="right-0 lg:right-auto" />
    </div>
  );
}
