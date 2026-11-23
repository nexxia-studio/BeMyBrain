# Handoff — état courant

**Dernière mise à jour** : 2026-11-23 — session : `/handoff` après fusion de `effets-de-verre` (BRAIN-33)

## Où on en est
- Effets de verre (BRAIN-33) : terminé, fusionné dans `main` le 2026-11-23 (PR #11, commit `171e064`).
- Tâches 1 à 9 et QA-1 à QA-6 faites. `/qa` : 7 scénarios PASS (`docs/features/effets-de-verre/qa-report.md`). Essais iPhone validés.
- En production : migration verte, sans nouvelle migration ; build de production en ligne ; aucune erreur BeMyBrain dans Sentry depuis la mise en ligne.
- Tests rouges : `e2e/todo-aujourdhui.spec.ts`, données restées sur le compte e2e (BRAIN-52). Rien d'autre.

## Prochaine étape
Reproduire BRAIN-50 (écran d'erreur à l'ouverture après une mise en veille de la base, priorité haute), avec BRAIN-47 et BRAIN-54 (`@detail`, priorité moyenne, même cause).
Commande de reprise : `Reproduis BRAIN-50 (écran d'erreur à l'ouverture après mise en veille de la base) sur une branche depuis main, puis demande à Antoine correctif direct ou spec courte + plan (pas /feature : c'est un correctif).`

## Tickets ouverts par la feature
- BRAIN-50 (haute), BRAIN-51 (durcissements du pool), BRAIN-52 (isolation de l'e2e), BRAIN-53 (cookies de préférences), BRAIN-54 (`@detail`).

## Suite
- BRAIN-47 : `error.tsx` et `loading.tsx` dans `tasks/@detail`.
- Faible priorité : BRAIN-43 (relais iOS), BRAIN-44 (contrôles désactivés après un ajout), BRAIN-45 (pagination de la corbeille).
- Design à trancher (plan, tâche 18) : menus Date et Tags sur mobile, Notes trop haut, « Demain » = « Ce week-end » le vendredi, place vide à 1440 px, survol, icônes de priorité (ticket proposé).
- BRAIN-26 : essai Android, owner/member, choix du workspace. BRAIN-37 : ordre migration / mise en ligne. BRAIN-35 : source maps Sentry. BRAIN-36 : deux GET `/settings` par clic. BRAIN-49 : durcissements sécurité (existant).

## Questions ouvertes
- `SEED_OWNER_USER_ID` : secret GitHub en place, migration verte. Antoine supprime la variable GitHub.
- jose : JWKS distant non joué (kid inconnu sous 30 s, réseau coupé ; cache périmé).
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : règle Seer de la PR 1135934 laissée ; BEMYBRAIN-1 ouverte.
- Jeton Vercel CI à renouveler avant le 2027-02-08. MCP Vercel sans accès au pare-feu (404).
