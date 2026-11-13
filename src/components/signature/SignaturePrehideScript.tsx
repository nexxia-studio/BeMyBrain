// Script en ligne (nonce CSP) qui masque les cibles des moments signature du tableau de bord avant la
// première peinture d'un chargement complet (rechargement, ouverture de la PWA sur /dashboard).
// Rendu dans le <head> du layout racine : React ne le recrée jamais côté client (il n'exécuterait pas un
// script qu'il insère, et le signale). Sur les autres pages, il n'a aucune cible ; une navigation côté
// client vers le tableau de bord est couverte par BentoGrid (prehidePendingMoments).
import { readCspNonce } from "@/lib/csp-nonce";

import { signaturePrehideScript } from "./signature-keys";

export async function SignaturePrehideScript() {
  const nonce = await readCspNonce();

  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: signaturePrehideScript() }}
    />
  );
}
