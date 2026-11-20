"use client";

// Démo des effets de verre (BRAIN-33) : joue l'une des trois directions sur la vraie grille du tableau de
// bord, à chaque changement de direction ou clic sur « Rejouer ». Chargé par next/dynamic : GSAP reste hors
// du bundle initial. Jamais d'animation de backdrop-filter (DESIGN.md § 7) : seuls opacity et transform
// bougent, sur les halos, les tuiles et des calques ajoutés dans les surfaces de verre.
// raccourci: code de démo, retiré avec la page une fois la direction choisie ; la version retenue sera
// réécrite sur la mécanique des moments (playOnce, masquage avant peinture).
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

import { releasePrehide } from "./signature-keys";

export type GlassDirection = "brume" | "givre" | "reflet";
/** Intensité de A et B (essai iPhone du 2026-11-20 : amplitudes de départ imperceptibles). */
export type GlassIntensity = "discret" | "moyen" | "marque";
/** Vitesse du balayage de C. */
export type GlassSpeed = "lent" | "moyen" | "rapide";

type GlassDemoStageProps = {
  /** Racine de la grille (tuiles `data-signature="intro"` et `"reveal"`). */
  rootRef: RefObject<HTMLElement | null>;
  /** Calque des halos, élément dédié aria-hidden. */
  haloRef: RefObject<HTMLElement | null>;
  direction: GlassDirection;
  intensity: GlassIntensity;
  speed: GlassSpeed;
  /** Simulation de « réduire les animations » : état final, rien ne bouge. */
  reduced: boolean;
  /** Incrémenté par « Rejouer ». */
  runId: number;
  /** Appelé une fois l'état de départ posé : la grille et les halos peuvent s'afficher. */
  onReady: () => void;
};

const TILE_PROPS = "opacity,visibility,transform";

// A · Brume : les halos arrivent de plus grand et décalés, puis se posent ; les tuiles n'entrent qu'ensuite.
const MIST = {
  discret: { scale: 1.2, yPercent: -4, duration: 0.9 },
  moyen: { scale: 1.45, yPercent: -8, duration: 1.1 },
  marque: { scale: 1.8, yPercent: -14, duration: 1.4 },
} as const satisfies Record<GlassIntensity, object>;

// B · Givre : voile teinté bleu-lilas (couleurs des halos), fondu tuile par tuile.
const FROST = {
  discret: { tint: 30, opacity: 0.85, duration: 0.9, stagger: 0.1 },
  moyen: { tint: 50, opacity: 0.95, duration: 1.1, stagger: 0.14 },
  marque: { tint: 75, opacity: 1, duration: 1.3, stagger: 0.18 },
} as const satisfies Record<GlassIntensity, object>;

// C · Reflet : durée d'un passage et décalage entre tuiles.
const SHEEN = {
  lent: { duration: 2.2, stagger: 0.16 },
  moyen: { duration: 1.5, stagger: 0.12 },
  rapide: { duration: 0.9, stagger: 0.08 },
} as const satisfies Record<GlassSpeed, object>;

function frostBackground(tint: number): string {
  return `linear-gradient(135deg, color-mix(in srgb, var(--halo-blue) ${tint}%, var(--popover)), color-mix(in srgb, var(--halo-lilac) ${tint}%, var(--popover)))`;
}
// Reflet teinté des halos (le blanc ne se voit pas sur un verre déjà blanc) : aucune couleur hors charte.
const SHEEN_BACKGROUND =
  "linear-gradient(105deg, transparent 30%, color-mix(in srgb, var(--halo-blue) 55%, transparent) 45%, color-mix(in srgb, var(--halo-lilac) 55%, transparent) 55%, transparent 70%)";

type Layer = { surface: HTMLElement; overlay: HTMLElement; restore: string };

/** Ajoute un calque sous le contenu de chaque surface de verre (jamais un second verre). */
function addLayers(surfaces: HTMLElement[], background: string): Layer[] {
  return surfaces.map((surface) => {
    const restore = surface.getAttribute("style") ?? "";
    surface.style.position = "relative";
    surface.style.isolation = "isolate";
    surface.style.overflow = "hidden";
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      zIndex: "-1",
      borderRadius: "inherit",
      pointerEvents: "none",
      // Couche composée dès sa création : pas de promotion ni de rétrogradation au milieu du balayage.
      willChange: "transform, opacity",
      background,
    });
    surface.prepend(overlay);
    return { surface, overlay, restore };
  });
}

function removeLayers(layers: Layer[]): void {
  for (const { surface, overlay, restore } of layers) {
    overlay.remove();
    if (restore === "") surface.removeAttribute("style");
    else surface.setAttribute("style", restore);
  }
}

export function GlassDemoStage({
  rootRef,
  haloRef,
  direction,
  intensity,
  speed,
  reduced,
  runId,
  onReady,
}: GlassDemoStageProps) {
  useGSAP(
    () => {
      // Le script de masquage des moments du tableau de bord peut avoir caché ces tuiles : la démo les prend.
      releasePrehide("intro");
      releasePrehide("reveal");
      releasePrehide("empty");

      const root = rootRef.current;
      const halo = haloRef.current;
      const systemReduced = matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!root || !halo || reduced || systemReduced) {
        onReady();
        return;
      }

      const today = root.querySelector<HTMLElement>('[data-signature="intro"]');
      const todayItems = today
        ? [...today.querySelectorAll<HTMLElement>("[data-signature-item]")]
        : [];
      const tiles = [
        ...root.querySelectorAll<HTMLElement>('[data-signature="reveal"]'),
      ];
      const surfaces = [...root.querySelectorAll<HTMLElement>(".glass")];
      let layers: Layer[] = [];

      const tl = gsap.timeline();
      // Règle de fluidité : rien ne bouge derrière un verre visible (le flou serait recalculé à chaque image).
      // A : les halos se posent entièrement avant la première tuile. C : halos fixes, comme B.
      let todayAt = 0;
      if (direction === "brume") {
        const mist = MIST[intensity];
        tl.fromTo(
          halo,
          { autoAlpha: 0, scale: mist.scale, yPercent: mist.yPercent },
          {
            autoAlpha: 1,
            scale: 1,
            yPercent: 0,
            duration: mist.duration,
            ease: "power2.out",
            force3D: true,
            clearProps: "transform",
          },
          0,
        );
        todayAt = mist.duration;
      }
      const tilesAt = todayAt + 0.15;

      if (today) {
        tl.from(
          today,
          {
            autoAlpha: 0,
            y: 16,
            duration: 0.6,
            ease: "power3.out",
            clearProps: TILE_PROPS,
          },
          todayAt,
        );
        tl.from(
          todayItems,
          {
            autoAlpha: 0,
            y: 16,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.08,
            clearProps: TILE_PROPS,
          },
          todayAt + 0.08,
        );
      }
      const each = Math.min(0.05, 0.4 / Math.max(tiles.length - 1, 1));
      const tilesDuration = 0.5;
      tl.from(
        tiles,
        {
          autoAlpha: 0,
          y: 24,
          duration: tilesDuration,
          ease: "expo.out",
          stagger: each,
          clearProps: TILE_PROPS,
        },
        tilesAt,
      );
      // Fin du mouvement des tuiles : le balayage C ne démarre qu'une fois toutes immobiles.
      const tilesSettled = Math.max(
        todayAt + 0.08 + 0.6 + 0.08 * Math.max(todayItems.length - 1, 0),
        tilesAt + each * Math.max(tiles.length - 1, 0) + tilesDuration,
      );

      if (direction === "givre") {
        const frost = FROST[intensity];
        layers = addLayers(surfaces, frostBackground(frost.tint));
        tl.fromTo(
          layers.map((layer) => layer.overlay),
          { opacity: frost.opacity },
          {
            opacity: 0,
            duration: frost.duration,
            ease: "power1.inOut",
            stagger: frost.stagger,
          },
          tilesAt + 0.3,
        );
      }
      if (direction === "reflet") {
        const sheen = SHEEN[speed];
        layers = addLayers(surfaces, SHEEN_BACKGROUND);
        tl.fromTo(
          layers.map((layer) => layer.overlay),
          { xPercent: -110 },
          {
            xPercent: 110,
            duration: sheen.duration,
            ease: "sine.inOut",
            stagger: sheen.stagger,
            force3D: true,
          },
          tilesSettled + 0.1,
        );
      }
      tl.call(() => {
        removeLayers(layers);
        layers = [];
      });

      onReady();
      return () => removeLayers(layers);
    },
    {
      dependencies: [direction, intensity, speed, reduced, runId],
      revertOnUpdate: true,
    },
  );

  return null;
}
