// Emplacement `@detail` hors interception : liste seule, ou détail ouvert directement par son adresse (rendu
// alors par `(list)/[id]/page.tsx`, liste comprise). Requis pour un chargement complet de `/tasks` et `/tasks/[id]`.
export default function DetailDefault() {
  return null;
}
