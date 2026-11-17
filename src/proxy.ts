import { NextRequest, NextResponse } from "next/server";

import { LOGIN_PATH, PUBLIC_ROUTES } from "@/lib/auth/routes";
import { getAuth } from "@/lib/auth/server";
import {
  contentSecurityPolicy,
  createNonce,
  CSP_NONCE_MARKER_HEADER,
} from "@/lib/security-headers";

// Convention Next 16 : proxy.ts remplace middleware.ts (runtime Node.js).
// Toute page sans session valide est redirigée vers /login, sauf les routes publiques.
// Garde optimiste : le layout de (app) revérifie la session côté serveur.
// Pose aussi la CSP à nonce de chaque page (doc Next « Content Security Policy ») : toutes les pages
// sont rendues à la demande (cookies lus partout), Next applique le nonce lu dans l'en-tête de requête.

// Dernier segment avec extension (`/x.png`, `/robots.txt`) : aucune page de l'app n'en a. Les vrais fichiers
// statiques sont exclus par le matcher ; ce qui arrive ici n'existe pas et Next rend sa 404 HTML. Elle
// reçoit la CSP, sans passer par l'auth : pas de redirection vers /login pour une icône absente (iOS
// demande /apple-touch-icon.png d'office). Aucune donnée n'est exposée, la 404 n'utilise que le layout
// racine.
const FILE_LIKE_PATH = /\.[^/]+$/;

let middleware: ((request: NextRequest) => Promise<Response>) | undefined;

export default async function proxy(request: NextRequest) {
  middleware ??= getAuth().middleware({
    loginUrl: LOGIN_PATH,
    publicRoutes: PUBLIC_ROUTES,
  });
  const nonce = createNonce();
  const policy = contentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
  });
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", policy);
  // Marqueur interne, toujours écrasé : readCspNonce ne lit le nonce que s'il vient d'ici.
  headers.set(CSP_NONCE_MARKER_HEADER, nonce);
  // Le SDK transmet au rendu les en-têtes de la requête qu'il reçoit (NextResponse.next({ request })).
  const response = FILE_LIKE_PATH.test(request.nextUrl.pathname)
    ? NextResponse.next({ request: { headers } })
    : await middleware(new NextRequest(request, { headers }));
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  matcher: [
    // Exclus : seulement les fichiers statiques réellement servis (assets du build, optimiseur d'images,
    // favicon, manifeste, icônes de public/icons, listées par nom et vérifiées par src/proxy.test.ts).
    // Tout le reste passe ici, y compris une URL à extension inexistante : sa 404 HTML porte la CSP.
    // Littéral obligatoire : Next lit le matcher statiquement au build.
    "/((?!_next/static/|_next/image|favicon\\.ico$|manifest\\.webmanifest$|icons/(?:icon-192|icon-512|icon-maskable-512|apple-touch-icon)\\.png$).*)",
  ],
};
