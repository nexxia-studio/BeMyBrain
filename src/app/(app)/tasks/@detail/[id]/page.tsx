// Détail `/tasks/[id]` au chargement complet (rechargement, lien profond) : rendu dans l'emplacement `@detail`,
// au-dessus de la liste rendue par `[id]/page.tsx`. Même rendu que la route interceptée `(.)[id]` : ainsi une
// navigation côté client qui suit (parente, sous-tâche) remplace ce détail dans le même emplacement au lieu d'en
// superposer un second.
export { default } from "../(.)[id]/page";
