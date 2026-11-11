# Pièges connus

<!-- Une ligne par piège : symptôme → cause → parade. Grep avant d'ajouter. L'agent scribe alimente ce fichier. -->
<!-- Les trois dernières lignes viennent de projets précédents ; supprime celles qui ne s'appliquent pas. -->

- Edit d'un .ts bloqué (exit 2) avant que le projet existe → le hook PostToolUse lance prettier/eslint → scaffold et `pnpm install` en Bash avant toute édition de .ts.
- Montant faux de quelques centimes après calcul → float côté JS → stocker et calculer en entiers `_cents`, formater seulement à l'affichage.
- Enum Postgres impossible à modifier sans migration lourde → utiliser `text` + `CHECK (col IN (...))`.
- Formulaire de contact spammé → ajouter honeypot + rate limit + vérification du temps de remplissage ; tester en local, jamais sur le formulaire en prod.
