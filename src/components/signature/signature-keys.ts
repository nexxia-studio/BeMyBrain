// Marqueurs sessionStorage des moments signature (présent = déjà joué dans la session).
// Fichier sans GSAP : importé par les composants du bundle initial pour savoir s'il faut charger le moment.
export const SIDE_SWITCH_SIGNATURE_KEY = "bmb_signature_side_switch";
/** Autre moitié de la bascule : fondu des tuiles du nouveau côté (DESIGN.md § 7). */
export const SIDE_SWITCH_TILES_SIGNATURE_KEY =
  "bmb_signature_side_switch_tiles";
export const DASHBOARD_INTRO_SIGNATURE_KEY = "bmb_signature_dashboard_intro";
export const BENTO_REVEAL_SIGNATURE_KEY = "bmb_signature_bento_reveal";
export const EMPTY_STATE_SIGNATURE_KEY = "bmb_signature_empty_state";

/** Vrai si le moment n'a pas encore été joué dans cette session. */
export function isSignaturePending(key: string): boolean {
  return sessionStorage.getItem(key) === null;
}

export function markSignaturePlayed(key: string): void {
  sessionStorage.setItem(key, "1");
}

/**
 * Le fondu des tuiles ne joue qu'avec la première glissade de la pilule. Si la première bascule de la
 * session a eu lieu avant l'affichage de la grille (autre page, rechargement), la moitié « tuiles » est
 * consommée : la bascule suivante sera instantanée, comme la pilule.
 */
export function isTilesFadePending(): boolean {
  if (!isSignaturePending(SIDE_SWITCH_SIGNATURE_KEY)) {
    markSignaturePlayed(SIDE_SWITCH_TILES_SIGNATURE_KEY);
  }
  return isSignaturePending(SIDE_SWITCH_TILES_SIGNATURE_KEY);
}

// Masquage avant la première peinture. Les moments du tableau de bord partent de l'état caché
// (autoAlpha 0) ; GSAP arrive après l'hydratation (next/dynamic). Sans masquage, les tuiles rendues par
// le serveur s'afficheraient, disparaîtraient puis réapparaîtraient. Un script en ligne (nonce CSP),
// placé avant la grille, pose sur <html> la liste des moments à jouer ; globals.css masque leurs cibles
// (`data-signature`) ; chaque moment retire son nom en démarrant.

/** Attribut de <html> : noms des moments en attente, séparés par des espaces. */
export const SIGNATURE_PENDING_ATTRIBUTE = "data-signature-pending";

export type PrehiddenMoment = "intro" | "reveal" | "empty";

const PREHIDDEN_MOMENTS: readonly (readonly [PrehiddenMoment, string])[] = [
  ["intro", DASHBOARD_INTRO_SIGNATURE_KEY],
  ["reveal", BENTO_REVEAL_SIGNATURE_KEY],
  ["empty", EMPTY_STATE_SIGNATURE_KEY],
];

/** Filet si GSAP ne se charge pas : tout réapparaît, sans animation. */
const PREHIDE_TIMEOUT_MS = 3000;

/** Corps du script en ligne (aucune donnée de l'utilisateur, seulement des constantes). */
export function signaturePrehideScript(): string {
  const moments = JSON.stringify(PREHIDDEN_MOMENTS);
  const attribute = JSON.stringify(SIGNATURE_PENDING_ATTRIBUTE);
  return `(function(){try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var p=${moments}.filter(function(m){return sessionStorage.getItem(m[1])===null}).map(function(m){return m[0]});if(!p.length)return;var d=document.documentElement;d.setAttribute(${attribute},p.join(" "));setTimeout(function(){d.removeAttribute(${attribute})},${PREHIDE_TIMEOUT_MS})}catch(e){}})();`;
}

/**
 * Même masquage que le script en ligne, pour une navigation côté client vers le tableau de bord (React
 * n'exécute pas un script en ligne qu'il insère). Appelé par BentoGrid avant la peinture.
 */
export function prehidePendingMoments(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const pending = PREHIDDEN_MOMENTS.filter(([, key]) =>
    isSignaturePending(key),
  ).map(([moment]) => moment);
  if (pending.length === 0) return;
  const html = document.documentElement;
  html.setAttribute(SIGNATURE_PENDING_ATTRIBUTE, pending.join(" "));
  setTimeout(
    () => html.removeAttribute(SIGNATURE_PENDING_ATTRIBUTE),
    PREHIDE_TIMEOUT_MS,
  );
}

/** Démasque les cibles d'un moment (appelé quand il démarre, ou qu'il est coupé). */
export function releasePrehide(moment: PrehiddenMoment): void {
  const html = document.documentElement;
  const rest = (html.getAttribute(SIGNATURE_PENDING_ATTRIBUTE) ?? "")
    .split(" ")
    .filter((name) => name !== "" && name !== moment);
  if (rest.length > 0) {
    html.setAttribute(SIGNATURE_PENDING_ATTRIBUTE, rest.join(" "));
  } else {
    html.removeAttribute(SIGNATURE_PENDING_ATTRIBUTE);
  }
}
