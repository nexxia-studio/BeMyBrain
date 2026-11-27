import { redirect } from "next/navigation";
import { Component, type ReactNode } from "react";

/** Erreur de contrôle levée par `redirect()` de Next, telle que le client la reçoit d'une action. */
export function redirectError(url: string): unknown {
  try {
    redirect(url);
  } catch (error) {
    return error;
  }
}

/**
 * Renvoi vers /login d'une action dont la session a expiré (QA-1), tel que le client de Next le rend à
 * l'appelant : il a déjà navigué lui-même et rejette la promesse de l'action avec l'erreur marquée `handled`
 * (`createRedirectErrorForAction`, server-action-reducer). La frontière de Next qui la reçoit ne navigue pas une
 * seconde fois, elle remonte seulement le sous-arbre.
 */
export const expiredSessionRedirect = () =>
  Object.assign(redirectError("/login?next=%2Fdashboard") as object, {
    handled: true,
  });

/**
 * Frontière d'erreur de test : tient la place de la RedirectBoundary de Next, qui reçoit l'erreur de
 * contrôle relancée et navigue. Ne rend plus rien après l'avoir reçue.
 */
export class CaughtBoundary extends Component<
  { children: ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
