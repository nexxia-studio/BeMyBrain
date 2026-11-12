import type { NextRequest } from "next/server";

import { LOGIN_PATH, PUBLIC_ROUTES } from "@/lib/auth/routes";
import { getAuth } from "@/lib/auth/server";

// Convention Next 16 : proxy.ts remplace middleware.ts (runtime Node.js).
// Toute page sans session valide est redirigée vers /login, sauf les routes publiques.
// Garde optimiste : le layout de (app) revérifie la session côté serveur.

let middleware: ((request: NextRequest) => Promise<Response>) | undefined;

export default function proxy(request: NextRequest) {
  middleware ??= getAuth().middleware({
    loginUrl: LOGIN_PATH,
    publicRoutes: PUBLIC_ROUTES,
  });
  return middleware(request);
}

export const config = {
  matcher: [
    // Ni assets du build, ni optimiseur d'images, ni fichiers publics à extension (icônes, manifeste).
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|svg|jpg|jpeg|webp|webmanifest|txt|xml)$).*)",
  ],
};
