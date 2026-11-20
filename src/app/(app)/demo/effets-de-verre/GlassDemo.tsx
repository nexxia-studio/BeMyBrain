"use client";

// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Démo des effets de verre (BRAIN-33) : choix de la direction, « Rejouer », simulation de « réduire les
// animations », au-dessus de la vraie grille du tableau de bord. Les halos sont ici un élément dédié
// aria-hidden (DESIGN.md § 7) posé sur un fond brume opaque qui couvre ceux de body::before.
// raccourci: page temporaire, retirée une fois la direction choisie (demo-access.ts).
import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  GlassDirection,
  GlassIntensity,
  GlassSpeed,
} from "@/components/signature/glass-demo-stage";
import { SignatureBoundary } from "@/components/signature/SignatureBoundary";
import { cn } from "@/lib/utils";

const GlassDemoStage = dynamic(
  () =>
    import("@/components/signature/glass-demo-stage").then(
      (m) => m.GlassDemoStage,
    ),
  { ssr: false },
);

const DIRECTIONS: readonly GlassDirection[] = ["brume", "givre", "reflet"];
const INTENSITIES: readonly GlassIntensity[] = ["discret", "moyen", "marque"];
const SPEEDS: readonly GlassSpeed[] = ["lent", "moyen", "rapide"];

type PillGroupProps<T extends string> = {
  label: string;
  values: readonly T[];
  current: T;
  text: (value: T) => string;
  onPick: (value: T) => void;
};

function PillGroup<T extends string>({
  label,
  values,
  current,
  text,
  onPick,
}: PillGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-full bg-pill-track p-1"
    >
      {values.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          onClick={() => onPick(value)}
          className={cn(
            "min-h-11 rounded-full px-3 text-small font-semibold text-muted-foreground",
            current === value && "bg-pill-active text-foreground shadow-raised",
          )}
        >
          {text(value)}
        </button>
      ))}
    </div>
  );
}

type GlassDemoProps = {
  /** Tuiles du tableau de bord, rendues par le serveur avec les vraies données. */
  children: React.ReactNode;
};

export function GlassDemo({ children }: GlassDemoProps) {
  const t = useTranslations("glassDemo");
  const systemReduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<GlassDirection>("brume");
  const [intensity, setIntensity] = useState<GlassIntensity>("moyen");
  const [speed, setSpeed] = useState<GlassSpeed>("moyen");
  const [reduced, setReduced] = useState(false);
  const [runId, setRunId] = useState(0);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  // Chaque rejeu repart du haut de la page : le moment se joue à l'ouverture, grille en haut de l'écran.
  const replay = (change?: () => void) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    change?.();
    setRunId((n) => n + 1);
  };
  // Filet si GSAP ne se charge pas : tout s'affiche, sans animation (même délai que les moments).
  useEffect(() => {
    const timer = setTimeout(markReady, 3000);
    return () => clearTimeout(timer);
  }, [markReady]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-(--z-halo) bg-background"
      />
      <div
        ref={haloRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 z-(--z-halo) bg-(image:--halo-layers)",
          !ready && "invisible",
        )}
      />

      {/* Barre compacte : la grille doit commencer au même endroit que sur le tableau de bord. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PillGroup
          label={t("direction")}
          values={DIRECTIONS}
          current={direction}
          text={(value) => t(`directions.${value}`)}
          onPick={(value) => replay(() => setDirection(value))}
        />
        {direction === "reflet" ? (
          <PillGroup
            label={t("speed")}
            values={SPEEDS}
            current={speed}
            text={(value) => t(`speeds.${value}`)}
            onPick={(value) => replay(() => setSpeed(value))}
          />
        ) : (
          <PillGroup
            label={t("intensity")}
            values={INTENSITIES}
            current={intensity}
            text={(value) => t(`intensities.${value}`)}
            onPick={(value) => replay(() => setIntensity(value))}
          />
        )}
        <button
          type="button"
          onClick={() => replay()}
          className="min-h-11 rounded-full bg-primary px-4 text-small font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          {t("replay")}
        </button>
        <label className="flex min-h-11 items-center gap-2 text-small text-foreground">
          <input
            type="checkbox"
            checked={reduced}
            onChange={(event) => {
              const checked = event.target.checked;
              replay(() => setReduced(checked));
            }}
            className="size-5"
          />
          {t("reduceMotion")}
        </label>
        {systemReduced ? (
          <p role="status" className="text-small text-muted-foreground">
            {t("systemReduced")}
          </p>
        ) : null}
      </div>

      <div
        ref={rootRef}
        className={cn("flex flex-wrap gap-grid", !ready && "invisible")}
      >
        {children}
      </div>

      <SignatureBoundary>
        <GlassDemoStage
          rootRef={rootRef}
          haloRef={haloRef}
          direction={direction}
          intensity={intensity}
          speed={speed}
          reduced={reduced}
          runId={runId}
          onReady={markReady}
        />
      </SignatureBoundary>
    </>
  );
}
