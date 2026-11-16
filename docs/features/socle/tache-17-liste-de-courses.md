# Tâche 17 — liste de courses

Règle pendant toute la séance : aucun secret ne passe par moi. Tu colles chaque valeur directement dans Neon, GitHub ou Vercel ; je te dis où, et je vérifie ensuite que la variable existe (sans lire sa valeur).

## À avoir ouvert avant de commencer (5 min)
- Console Neon, organisation propriétaire du projet `bemybrain`, avec droit de changer la formule.
- GitHub, droit admin sur `nexxia-studio/BeMyBrain` (secrets, environnements, protection de `main`).
- Vercel, équipe nexxia-studio, rôle Owner (création de projet, pare-feu, Deployment Checks).
- 1Password déverrouillé.
- Un terminal pour `openssl rand -base64 32`.
- Pour la fin : un iPhone (Safari) et un Android (Chrome).

## Décisions à prendre avant (à trancher en 2 min)
- Formule Neon : la protection de `production` exige Launch ou plus. Sinon on note la limite dans ADR-010.
- Formule Vercel : Deployment Checks disponible ? Sinon plan B (Deploy Hook appelé après la migration).

## Dans l'ordre où je te les demanderai

| # | Où | Ce qu'il faut | Source | Durée |
|---|---|---|---|---|
| 1 | Neon | Protéger la branche `production` | Console (formule payante) | 5 min |
| 2 | Neon | Rien à fournir : je vérifie les migrations sur `test` | Moi, outil Neon | 2 min |
| 3 | Neon | Créer une clé d'API **limitée au projet `bemybrain`** | Console Neon → la coller en 4 | 5 min |
| 4 | GitHub, secrets du dépôt | `NEON_API_KEY` (clé de 3), `NEON_PROJECT_ID` | Clé de 3 ; id projet : je te le donne | 5 min |
| 5 | GitHub, environnement `production` | Branches de déploiement = `main` ; secret `DATABASE_URL` (propriétaire de `production`) ; variable `SEED_OWNER_USER_ID` (ton id utilisateur sur `production`) | `DATABASE_URL` : **1Password** ; id : console Neon Auth de `production` | 10 min |
| 6 | GitHub | Protection de `main` : 2 checks requis, pas de contournement | Réglages du dépôt | 5 min |
| 7 | Vercel | Créer le projet BeMyBrain, relié au dépôt, Francfort, production sur `main` | Je peux le créer via l'outil Vercel avec ton accord | 5 min |
| 8 | Vercel, variables Production | `DATABASE_AUTHENTICATED_URL` (`app_backend` sur `production`) ; `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`, `NEON_AUTH_AUDIENCE` ; `NEON_AUTH_COOKIE_SECRET` | Mot de passe `app_backend` de prod : **1Password** ; URLs Neon Auth : console Neon (non secrètes, je peux te les donner) ; cookie : `openssl rand -base64 32`, nouveau | 15 min |
| 9 | Vercel | Deployment Checks → « Migrer la production » | Réglages du projet | 5 min |
| 10 | Vercel + GitHub | Jeton Vercel **limité au projet** → secret GitHub `VERCEL_TOKEN` ; variables `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` ; `NEON_AUTH_COOKIE_SECRET` de preview (nouveau, différent de la prod) | Jeton : CLI ou console Vercel ; ids : je te les donne | 15 min |
| 10b | Vercel | Vérifier la Deployment Protection sur les previews | Moi, outil Vercel | 2 min |
| 11 | Vercel, pare-feu | Rate limit des POST sur `/login` et `/reset-password` | Console Vercel | 10 min |
| 12 | Neon Auth `production` | Activer `revoke_sessions_on_password_reset` ; domaine de confiance = URL Vercel de prod | Console Neon (toi : refusé à l'agent) | 5 min |
| 12b | Ton `.env` local | Ajouter l'hôte Vercel de prod à `E2E_FORBIDDEN_HOSTS` | Toi | 1 min |
| 13 | GitHub | Je pousse, j'ouvre une PR de contrôle ; on lit la CI ensemble (aucun hôte en clair dans les journaux) | Moi | 20 min (CI) |
| 14 | GitHub | Merge dans `main` : **ton accord explicite** ; « Migrer la production » vert, domaine attribué | Toi | 10 min |
| 15 | Téléphones | Ajout à l'écran d'accueil iPhone et Android, plein écran, icône, audit Chrome | Toi, moi je note | 15 min |

**Total : environ 2 h 15**, dont ~1 h de clics de ton côté et ~30 min d'attente CI et déploiement.

## Depuis 1Password, en résumé
1. `DATABASE_URL` propriétaire de `production` → secret de l'environnement GitHub `production` (étape 5). Nulle part ailleurs.
2. Mot de passe `app_backend` de `production` → `DATABASE_AUTHENTICATED_URL` dans Vercel Production (étape 8).

## À créer pendant la séance (puis ranger dans 1Password)
- Clé d'API Neon du projet (étape 3).
- `NEON_AUTH_COOKIE_SECRET` production et preview (étapes 8 et 10).
- Jeton Vercel du projet (étape 10).
