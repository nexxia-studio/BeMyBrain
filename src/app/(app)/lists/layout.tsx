// Layout de `/lists` : Courses, Wishlist et Bucket List n'existent que côté Privé (spec listes, Q3).
// Garde du côté actif (cookie, `readSide`, même lecture que le layout de la coque) : côté Pro, renvoi vers
// l'accueil avant tout rendu et avant toute lecture de liste. Posée ici, au-dessus des `loading.tsx`, et non
// dans la page : une garde sous un `loading.tsx` aurait un statut 200 déjà parti (docs/gotchas.md).
// raccourci: une bascule en Pro faite depuis /lists ne renvoie vers l'accueil qu'au rechargement de la page —
// quand la bascule renverra elle-même vers /dashboard hors des sections Privé.
import { redirect } from "next/navigation";

import { HOME_PATH } from "@/lib/auth/routes";
import { readSide } from "@/lib/preferences";

export default async function ListsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if ((await readSide()) !== "private") redirect(HOME_PATH);
  return children;
}
