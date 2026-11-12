// Chemins de l'auth, partagés par le proxy, les pages et les actions serveur.
export const LOGIN_PATH = "/login";
export const RESET_PASSWORD_PATH = "/reset-password";
export const HOME_PATH = "/dashboard";
// Utilisateur connecté sans appartenance : hors du groupe (app), dont le layout appelle requireSession.
export const NO_WORKSPACE_PATH = "/no-workspace";

// Accessibles sans session, en plus de LOGIN_PATH et de ses sous-chemins (toujours laissés
// passer par le SDK). Une entrée couvre le chemin exact et ses sous-chemins « /x/... ».
// Le SDK ajoute ses propres routes (/api/auth, /auth/sign-in...) : aucune n'existe dans l'app (404).
export const PUBLIC_ROUTES = [
  RESET_PASSWORD_PATH,
  "/manifest.webmanifest",
  "/icons",
];
