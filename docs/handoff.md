# Handoff — état courant

**Dernière mise à jour** : 2026-11-24 — session : `/handoff` après PR #13 (BRAIN-50, BRAIN-47, BRAIN-54)

## Où on en est
- PR #13 `fix/brain-50-veille-base` : fusionnée le 2026-11-24 (à corriger si la fusion a échoué). Reviewer et security-auditor OK, `/qa` PASS.
- BRAIN-50 (connexions mortes après veille Neon) : solution C, une nouvelle tentative avant le travail métier (`src/db/transaction-retry.ts`). BRAIN-47 (erreur du détail) et BRAIN-54 (groupe `tasks/(list)/`) faits dans la même PR.
- BRAIN-50 reste OUVERT « à confirmer en production » : sur preview, aucune ligne « Nouvelle tentative » (critère prouvé en local, `qa-report.md`).
- Mot de passe `app_backend` de la branche `test` changé le 2026-11-23 (fuite dans une sortie d'agent). Règle « Secrets dans les sorties » ajoutée aux agents.
- Tests rouges : BRAIN-52 (`e2e/todo-aujourdhui.spec.ts`). Rien d'autre.

## Prochaine étape
Surveiller dans les journaux Vercel de production la ligne « Nouvelle tentative sur le pool », suivie d'un affichage normal : c'est ce qui ferme BRAIN-50. Si elle n'apparaît pas, prendre BRAIN-51 (durcissements du pool), le plus proche du code.
Commande de reprise : `Lis docs/runbooks/veille-base.md et docs/features/brain-50-veille-base/qa-report.md. Vérifie si la production a écrit « Nouvelle tentative sur le pool » (BRAIN-50). Si oui, ferme BRAIN-50. Si non, propose BRAIN-51 en spec courte + plan (pas /feature : correctif).`

## Restes connus
- BRAIN-50 : ~35 `rejects.toMatchObject` dans `tests/db` à passer sur `errorTag` ; e2e `todo-chargement` à prouver ; scénario 2 de `/qa` et mode `--suspend` non joués.
- Ticket Linear « retour visible à l'ouverture d'un détail lent » (créé le 2026-11-24, priorité moyenne).

## Suite
- BRAIN-51 (durcissements du pool), BRAIN-53, BRAIN-52. Faible priorité : BRAIN-43, BRAIN-44, BRAIN-45.
- Design à trancher (`effets-de-verre`, tâche 18) : menus Date et Tags mobile, Notes, « Demain » le vendredi, place vide à 1440 px, survol, icônes de priorité.
- BRAIN-26, BRAIN-37, BRAIN-35, BRAIN-36, BRAIN-49 (inchangés).

## Questions ouvertes
- `SEED_OWNER_USER_ID` : secret GitHub en place, migration verte. Antoine supprime la variable GitHub.
- jose : JWKS distant non joué (kid inconnu sous 30 s, réseau coupé ; cache périmé).
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : règle Seer de la PR 1135934 laissée ; BEMYBRAIN-1 ouverte.
- Jeton Vercel CI à renouveler avant le 2027-02-08. MCP Vercel sans accès au pare-feu (404).
