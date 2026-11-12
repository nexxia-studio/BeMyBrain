import { NextRequest } from "next/server";

import { LOGIN_PATH, PUBLIC_ROUTES } from "@/lib/auth/routes";
import { getAuth } from "@/lib/auth/server";
import { contentSecurityPolicy, createNonce } from "@/lib/security-headers";

// Convention Next 16 : proxy.ts remplace middleware.ts (runtime Node.js).
// Toute page sans session valide est redirigée vers /login, sauf les routes publiques.
// Garde optimiste : le layout de (app) revérifie la session côté serveur.
// Pose aussi la CSP à nonce de chaque page (doc Next « Content Security Policy ») : toutes les pages
// sont rendues à la demande (cookies lus partout), Next applique le nonce lu dans l'en-tête de requête.

let middleware: ((request: NextRequest) => Promise<Response>) | undefined;

export default async function proxy(request: NextRequest) {
  middleware ??= getAuth().middleware({
    loginUrl: LOGIN_PATH,
    publicRoutes: PUBLIC_ROUTES,
  });
  const policy = contentSecurityPolicy({
    nonce: createNonce(),
    isDevelopment: process.env.NODE_ENV === "development",
  });
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", policy);
  // Le SDK transmet au rendu les en-têtes de la requête qu'il reçoit (NextResponse.next({ request })).
  const response = await middleware(new NextRequest(request, { headers }));
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  matcher: [
    // Ni assets du build, ni optimiseur d'images, ni fichiers publics à extension (icônes, manifeste).
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|svg|jpg|jpeg|webp|webmanifest|txt|xml)$).*)",
  ],
};
