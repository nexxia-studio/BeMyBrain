// Chargement du détail ouvert par son adresse (rechargement, lien profond ; BRAIN-54) : rien. Ce `Suspense` propre
// à l'emplacement laisse la liste afficher son givre (`(list)/loading.tsx`) sans attendre la lecture du détail,
// qui arrive ensuite dans sa fenêtre. Ouvert depuis la liste (`(.)[id]`), aucun chargement : Next garde la liste
// affichée jusqu'à l'arrivée du détail, et un détail remplacé par un autre (parente, sous-tâche) reste affiché
// jusque-là, sans éclair.
export default function DetailLoading() {
  return null;
}
