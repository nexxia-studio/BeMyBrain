"use client";

// Barrière d'erreur des moments signature chargés par next/dynamic. Un morceau introuvable (ancien
// déploiement, 404) ou une erreur du moment ne doit jamais atteindre error.tsx : le moment est décoratif.
// Elle ne rend alors rien et démasque les cibles du moment ; l'interface reste là, sans animation.
// Classe : React n'attrape les erreurs de rendu que dans un composant classe (exception à « fonction
// nommée » de frontend.md).
import { Component, type ReactNode } from "react";

import { type PrehiddenMoment, releasePrehide } from "./signature-keys";

type SignatureBoundaryProps = {
  /** Moments dont les cibles sont masquées avant la peinture, à démasquer en cas d'échec. */
  release?: readonly PrehiddenMoment[];
  children: ReactNode;
};

type SignatureBoundaryState = { failed: boolean };

export class SignatureBoundary extends Component<
  SignatureBoundaryProps,
  SignatureBoundaryState
> {
  state: SignatureBoundaryState = { failed: false };

  static getDerivedStateFromError(): SignatureBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    for (const moment of this.props.release ?? []) releasePrehide(moment);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
