// Layout de `/lists` : Courses, Wishlist et Bucket List n'existent que côté Privé (spec listes, Q3).
// Garde du côté actif (cookie, `readSide`, même lecture que le layout de la coque) : côté Pro, 404 avant tout
// rendu et avant toute lecture de liste. Posée ici, au-dessus des `loading.tsx`, et non dans la page : un
// `notFound()` sous un `loading.tsx` donnerait un statut 200 (docs/gotchas.md).
// raccourci: une bascule en Pro faite depuis /lists affiche la 404 jusqu'au rechargement de la page — quand
// la bascule renverra elle-même vers /dashboard hors des sections Privé.
import { notFound } from "next/navigation";

import { readSide } from "@/lib/preferences";

export default async function ListsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if ((await readSide()) !== "private") notFound();
  return children;
}
