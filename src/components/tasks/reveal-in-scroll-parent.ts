/**
 * Amène un élément dans le champ de vision du seul conteneur défilant qui l'entoure (le panneau ou le tiroir du
 * détail), par un calcul de `scrollTop`. Jamais `scrollIntoView` : sur iPhone il peut aussi faire défiler la page
 * ou faire sauter un conteneur fixe. Sans conteneur défilant au-dessus : ne fait rien. Un élément plus haut que le
 * conteneur garde son haut visible. Aucun effet sur le focus.
 */
export function revealInScrollParent(element: HTMLElement, margin = 8): void {
  let parent = element.parentElement;
  while (parent !== null) {
    const overflowY = getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") break;
    parent = parent.parentElement;
  }
  if (parent === null) return;

  const box = element.getBoundingClientRect();
  const view = parent.getBoundingClientRect();
  let delta = 0;
  if (box.bottom + margin > view.bottom) {
    delta = box.bottom + margin - view.bottom;
    // Le haut passe avant le bas : un élément trop haut reste lisible depuis son début.
    if (box.top - delta < view.top + margin) {
      delta = box.top - view.top - margin;
    }
  } else if (box.top - margin < view.top) {
    delta = box.top - margin - view.top;
  }
  if (delta !== 0) parent.scrollTop += delta;
}
