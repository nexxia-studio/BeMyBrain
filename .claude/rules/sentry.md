---
paths:
  - "src/**"
  - "sentry.*.config.ts"
---
# Règles Sentry (données métier)

- Aucune donnée métier (tâche, montant, santé, client, nom, e-mail, saisie) dans ce qui peut partir chez Sentry :
  - libellé d'erreur (`new Error(…)`, `throw`) : un code ou une phrase fixe, les valeurs en variable locale, jamais dans le message ;
  - message de console (`console.error`, `console.warn`) : idem, pas d'objet métier journalisé tel quel.
- Attributs d'accessibilité (`aria-label`, `title`, `alt`) : le contenu de l'utilisateur y est permis (l'accessibilité prime) ; un clic n'envoie à Sentry que le type d'élément, sans libellé.
- Le nettoyage de `src/lib/sentry-options.ts` est un filet, pas une autorisation : il ne reconnaît pas une donnée métier.
- Contexte attaché à un `captureException` : identifiants techniques seulement (uuid, nom de module, code d'action).
- Référence : `docs/runbooks/sentry.md`.
