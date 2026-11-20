// Emplacement `@detail` sur la liste `/tasks` : vide. Sans cette page, une navigation côté client vers `/tasks`
// (fermeture du détail) garderait l'état précédent de l'emplacement, le détail intercepté.
export default function DetailOnList() {
  return null;
}
