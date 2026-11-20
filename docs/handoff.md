# Handoff — état courant

**Dernière mise à jour** : 2026-11-20 — session : `/feature effets-de-verre` (BRAIN-33)

## Où on en est
- Feature en cours : effets de verre, branche `feat/effets-de-verre`, PR #11 en brouillon (preview = copie de la production, ADR-010).
- Démo jouée sur iPhone :
  - C · Reflet (lent, 2,2 s) retenu pour l'ouverture du tableau de bord ;
  - B · Givre (marqué) retenu pour les états de chargement, en CSS pur ;
  - A · Brume abandonnée.
- Spec et plan écrits : `docs/features/effets-de-verre/spec.md` (validée) et `plan.md` (9 tâches, la 6 en `[security]` ; bascule Privé / Pro abandonnée).
- Essai iPhone sur la preview prévu à la tâche 8, avant `/qa`. Démo supprimée à la tâche 9.
- BRAIN-48 créé : retour à la page demandée après connexion depuis un lien direct (remplace la note QA-1).
- Tests rouges : aucun.

## Prochaine étape
Tâche 1 (amender DESIGN.md).

## Suite
- Ticket à créer, proposé à Antoine : erreur du détail affichée par `tasks/error.tsx` sous la liste. Correction : `error.tsx` dans `@detail`.
- Faible priorité : BRAIN-43 (relais iOS, libéré à la fin de l'ouverture du tiroir), BRAIN-44 (contrôles désactivés après un ajout), BRAIN-45 (pagination de la corbeille).
- Design à trancher (plan, tâche 18) : menus Date et Tags sur mobile, Notes trop haut, « Demain » = « Ce week-end » le vendredi, place vide à 1440 px, survol, icônes de priorité (ticket proposé).
- BRAIN-26 : essai Android, owner/member, choix du workspace. BRAIN-37 : ordre migration / mise en ligne. BRAIN-35 : source maps Sentry. BRAIN-36 : deux GET `/settings` par clic.

## Questions ouvertes
- `SEED_OWNER_USER_ID` : secret GitHub en place, migration verte. Antoine supprime la variable GitHub.
- jose : JWKS distant non joué (kid inconnu sous 30 s, réseau coupé ; cache périmé).
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : règle Seer de la PR 1135934 laissée ; BEMYBRAIN-1 ouverte.
- Jeton Vercel CI à renouveler avant le 2027-02-08. MCP Vercel sans accès au pare-feu (404).

Commande de reprise :
`Exécute docs/features/effets-de-verre/plan.md avec subagent-driven-development, en dispatchant subagent_type implementer pour chaque tâche et subagent_type reviewer pour chaque review.`
