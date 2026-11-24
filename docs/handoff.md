# Handoff — état courant

**Dernière mise à jour** : 2026-11-25 — session : démo kanban, second essai iPhone (BRAIN-46)

## Où on en est
- **BRAIN-46 `todo-kanban`**, `feat/todo-kanban`, PR #14 brouillon, HEAD `431801c` poussé. Démo D1–D9 faites, relues (reviewer OK).
- Appui long (250 ms, soulèvement, empreinte) validé le 2026-11-24 : ne plus y toucher.
- Démo : sélecteur Cartes (Creux / Verre), détail hiérarchisé avec Nouveau / Actuel, ligne « Ajouter une sous-tâche ». Vrai détail et `TaskRow` repris ; `todo-unifiee/spec.md` mise à jour.
- À trancher : variante de cartes ; en Creux, survol et empreinte peu contrastés ; priorité sans couleur ; notes à 46 px ; « Notes » en semi-gras ; exception « Champs » (« à valider ») ; ombre de saisie `shadow-glass`. `/impeccable critique` non lancé.
- BRAIN-50 OUVERT « à confirmer en production » (`src/db/transaction-retry.ts`) : aucune ligne « Nouvelle tentative » sur preview. PR #13 fusionnée le 2026-11-24.
- `pnpm lint` rouge en local : 8 erreurs dans `qa-screenshots/` (gitignoré).
- Mot de passe `app_backend` de `test` changé le 2026-11-23 (fuite en sortie d'agent).
- Tests rouges : BRAIN-52 (`e2e/todo-aujourdhui.spec.ts`). Rien d'autre.

## Prochaine étape
Troisième essai d'Antoine (iPhone et ordinateur) et ses décisions sur les points à trancher, puis `spec.md` et `plan.md` du kanban.
Commande de reprise : `Lis docs/handoff.md et docs/features/todo-kanban/demo-plan.md (Retour du second essai, Restes connus). Demande à Antoine son troisième essai et ses décisions. Puis /feature todo-kanban : spec.md, puis plan.md. Appui long intouché.`

## Restes connus
- Démo : Entrée sur la carte juste fermée ne rouvre pas son détail (`openId`) ; notes faites de retours à la ligne rétrécissent au départ (`TaskNotesField.tsx`) ; test « espaces » sans compte d'appels. À traiter dans le plan réel.
- BRAIN-50 : ~35 `rejects.toMatchObject` à passer sur `errorTag` ; e2e `todo-chargement` à prouver sur `next start` ; `/qa` scénario 2 et `--suspend` non joués ; fermer après « Nouvelle tentative » dans les journaux de production.
- BRAIN-55 : retour visible à l'ouverture d'un détail lent (priorité moyenne).

## Suite
- BRAIN-51 (durcissements du pool), BRAIN-53, BRAIN-52. Faible priorité : BRAIN-43, 44, 45. Inchangés : BRAIN-26, 37, 35, 36, 49.
- Design à trancher (`effets-de-verre`, tâche 18) : menus Date et Tags mobile, Notes, « Demain » le vendredi, place vide à 1440 px, survol, icônes de priorité.

## Questions ouvertes
- `SEED_OWNER_USER_ID` : secret GitHub en place, migration verte ; Antoine supprime la variable GitHub.
- jose : JWKS distant non joué. E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : règle Seer PR 1135934 laissée ; BEMYBRAIN-1 ouverte. Jeton Vercel CI à renouveler avant le 2027-02-08 ; MCP Vercel sans accès au pare-feu (404).
