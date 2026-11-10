# Pièges connus

<!-- Une ligne par piège : symptôme → cause → parade. Grep avant d'ajouter. L'agent scribe alimente ce fichier. -->
<!-- Les quatre lignes ci-dessous viennent de tes projets précédents ; supprime celles qui ne s'appliquent pas. -->

- Edge Function appelée par un webhook (Stripe/Mollie) renvoie 401 → le JWT est vérifié par défaut → déployer avec `--no-verify-jwt` et vérifier la signature du webhook dans la fonction.
- Montant faux de quelques centimes après calcul → float côté JS → stocker et calculer en entiers `_cents`, formater seulement à l'affichage.
- Enum Postgres impossible à modifier sans migration lourde → utiliser `text` + `CHECK (col IN (...))`.
- Formulaire de contact spammé → ajouter honeypot + rate limit + vérification du temps de remplissage ; tester en local, jamais sur le formulaire en prod.
