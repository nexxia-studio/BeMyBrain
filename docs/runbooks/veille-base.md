# Veille de la base (BRAIN-50)

Dernière vérification : 2026-11-23 (tâche 5 du plan `docs/features/brain-50-veille-base/`).

## Symptôme
- Écran d'erreur à l'ouverture de l'app (souvent `/dashboard`) après un moment sans usage.
- Sentry : BEMYBRAIN-3, `DatabaseError` côté serveur.
- Erreur du pilote : « Connection terminated unexpectedly » (sans SQLSTATE) ou SQLSTATE `57P01`.
- Une nouvelle ouverture juste après fonctionne.

## Cause
- Vercel met la fonction en pause entre deux requêtes : minuteurs et sockets gelés.
- Pendant la pause, Neon met le compute en veille et coupe toutes les connexions.
- Au réveil, le pool prête ses connexions au repos avant d'avoir traité leur fermeture : elles sont mortes.
- Le délai d'inactivité du pool (30 s) n'expire jamais pendant la pause : il ne protège pas.
- Détail et mesures : `spec.md` de la feature, section Reproduction.

## Ce que fait le correctif
- Une seule nouvelle tentative, seulement si la connexion tombe avant le travail métier : prise de connexion, `BEGIN`, mise en place de l'identité.
- Dès que la fonction métier a commencé, aucune nouvelle tentative : une écriture n'est jamais rejouée.
- Seulement sur une erreur de connexion : jamais sur une erreur SQL, un refus RLS, un jeton refusé ou une erreur métier.
- Avant la nouvelle tentative : la connexion morte sort du pool, et les connexions au repos sont purgées.
- Code : `src/db/transaction-retry.ts` (`runTransaction`, `createPooledDb`), `src/db/pool.ts` (`evictIdle`).
- Chaque nouvelle tentative écrit une ligne de journal : « Nouvelle tentative sur le pool app_backend : connexion perdue (étape connexion) » (ou étape identité).
- La ligne ne contient ni identifiant, ni requête, ni message du pilote.
- Nouvelle tentative réussie : aucun envoi Sentry. Seule trace : la ligne de journal.
- Nouvelle tentative en échec : chemin habituel (`DatabaseError`, écran d'erreur, Sentry).
- Mesurer la fréquence : chercher « Nouvelle tentative sur le pool » dans les journaux Vercel (Logs du projet, filtre texte).

## Reproduction locale
- Script : `node --import tsx scripts/repro/veille-base.mts [--terminate|--suspend] [--branch test|dev]`.
- Défaut : `--terminate --branch test`.
- Le script lit `.env`. Il exige `NEON_PRODUCTION_HOST` et refuse une URL qui vise la production.
- Refusé sur GitHub Actions et Vercel : poste local seulement.
- Rien de secret n'est affiché : ni URL, ni hôte, ni clé, ni message du pilote.
- L'enfant est celui du test automatisé (`tests/factories/frozen-pool-child.mts`) : vrai pool, vrai `withUserDb`.
- Déroulé : chauffe de 4 connexions, gel de l'enfant (`SIGSTOP`), coupure, réveil (`SIGCONT`) et 4 lectures parallèles.

### `--terminate`
- Coupure par `pg_terminate_backend` des 4 backends de l'enfant, puis attente de leur disparition.
- Ne touche que les connexions de l'enfant : sans risque pour les autres tests de la branche.
- Erreur attendue au premier essai : `57P01`.

### `--suspend`
- Coupure par l'API Neon : `POST /projects/{id}/endpoints/{ep}/suspend`, puis attente de l'état `idle`.
- C'est la vraie veille : erreur attendue au premier essai « Connection terminated » (sans SQLSTATE).
- Variables à poser dans l'environnement du terminal, jamais dans un fichier versionné : `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_ENDPOINT_ID`.
- `NEON_ENDPOINT_ID` doit être l'endpoint de la branche visée par `--branch`, sinon refus.
- Coupe toutes les connexions de la branche : ne pas lancer pendant une suite de tests sur la même branche.

### Lire le verdict
- Correctif en place : 4/4 lectures OK, 4 nouvelles tentatives, 8 essais, 4 erreurs brutes, backends neufs, 4 connexions gardées.
- Sans correctif (avant le 2026-11-23) : 0/4 lectures OK en quelques millisecondes.
- Code de sortie : 0 si les 4 lectures réussissent, 1 sinon, 2 pour une erreur du script.
- Sortie du 2026-11-23, `--terminate` sur `test` : 4/4 lectures OK en 309 ms, 4 nouvelles tentatives, 4 × `57P01`.

## Vérification sur une preview
1. Pousser la branche, ouvrir la PR, attendre le déploiement de la preview Vercel.
2. Dans la console Neon, ouvrir la branche `preview/…` de la PR (créée par `preview-database.yml`).
3. Ouvrir la preview une première fois (`/dashboard`) : le pool de la fonction garde ses connexions.
4. Attendre quelques minutes sans requête, pour que Vercel mette la fonction en pause.
5. Mettre en veille le compute de la branche : console Neon, onglet Computes, « Suspend compute ». Ou l'API : même appel que `--suspend`.
6. Vérifier dans la console que le compute est à l'arrêt (Idle).
7. Ouvrir `/dashboard` sur la preview : le tableau de bord doit s'afficher, sans écran d'erreur.
8. Journaux Vercel de la preview : chercher « Nouvelle tentative sur le pool ». Une ligne par lecture rejouée.
9. Sentry, environnement `preview` : aucune nouvelle occurrence de BEMYBRAIN-3.
- Pas de ligne au point 8 : la fonction a pu être recyclée (nouvelle instance, pool vide). Rejouer depuis le point 3.

## Limite connue
- La purge du pool avant la nouvelle tentative est bornée à 500 ms (`EVICT_TIMEOUT_MS`).
- Au-delà, la nouvelle tentative part quand même : une connexion suspecte encore au repos peut lui être prêtée.
- Dans ce cas, le second essai échoue proprement : écran d'erreur, Sentry. Pas de troisième essai.
