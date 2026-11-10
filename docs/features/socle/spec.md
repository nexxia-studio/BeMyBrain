# Spec — Socle

**Créée le** : 2026-11-10 · **Statut** : brouillon · **Plan** : `plan.md` (à écrire au `/feature socle`)

## Objectif
Antoine se connecte à BeMyBrain en production et arrive sur un tableau de bord bento vide mais réel, où il bascule entre Privé et Pro (Trustup, Nexxia). Tous les modules suivants se posent dessus sans retoucher les fondations.

## Hors périmètre
- Tout module métier (to-do, listes, finance…).
- Inscription publique, abonnement, paiement, invitation d'un deuxième compte.
- RLS Postgres (ADR-002).
- Assistant IA, Umami, application mobile.

## Critères d'acceptation
- [ ] Quand un visiteur non connecté ouvre n'importe quelle page de l'app, alors il est renvoyé vers l'écran de connexion.
- [ ] Quand Antoine se connecte avec ses identifiants, alors il arrive sur le tableau de bord de son workspace.
- [ ] Quand la base est créée à neuf, alors les migrations produisent `workspaces`, `workspace_members`, `contexts`, et un script de départ crée le workspace d'Antoine avec les contextes Privé, Trustup et Nexxia.
- [ ] Quand Antoine choisit Privé ou Pro, alors le tableau de bord n'affiche que les tuiles de ce côté, et le choix est conservé au rechargement.
- [ ] Quand Antoine est côté Pro, alors il peut filtrer sur Trustup, Nexxia ou les deux.
- [ ] Quand une fonction de lecture est appelée avec un autre `workspaceId`, alors elle ne renvoie aucune donnée du workspace d'Antoine (test automatisé).
- [ ] Quand une pull request est ouverte, alors Vercel publie une preview reliée à sa propre branche Neon, et lint, typecheck et tests passent.
- [ ] Quand l'app est ouverte sur mobile, alors la grille bento passe en une colonne et la navigation reste utilisable au pouce.
- [ ] Quand `prefers-reduced-motion` est actif, alors aucune animation décorative ne joue.

## Scénarios utilisateur (joués par /qa)
1. **Première connexion** — Antoine part de l'URL de production, se connecte, obtient le tableau de bord avec ses contextes. Variante mobile : oui.
2. **Bascule Privé / Pro** — Antoine part du tableau de bord, passe en Pro, filtre sur Nexxia, recharge la page, retrouve le même état. Variante mobile : oui.
3. **Accès refusé** — un visiteur non connecté ouvre une URL interne, obtient l'écran de connexion et rien d'autre. Variante mobile : non.

## Données et sécurité
- Tables touchées : `workspaces`, `workspace_members`, `contexts` (nouvelles), plus les tables de l'auth retenue.
- Isolation : filtre `workspace_id` dans `src/modules/core/`, selon ADR-002. Pas de RLS en V1.
- Argent / paiement concerné : non. Les tâches d'auth et de session sont marquées `[security]`.

## UI
- Écrans concernés : connexion, coque (navigation, bascule Privé / Pro, filtre de contexte), tableau de bord bento avec tuiles vides.
- Maquette : aucune. Références : `docs/design/references/finance-glass.webp` et `maison-bento.webp`.
- Contraintes : DESIGN.md et PRODUCT.md à produire en première tâche (Impeccable + skill `nexxia-design`). Direction liquid glass, grille bento. Une seule bibliothèque d'animation : GSAP, pour quelques effets signature.

## Questions ouvertes
- [ ] Auth : valider ou changer la proposition de l'ADR-003 — à trancher par Antoine avant la tâche d'auth.
- [ ] Nom de domaine de production (sous-domaine Vercel ou domaine dédié) — avant la mise en production.
- [ ] Thème : clair, sombre, ou les deux dès le socle — avant la tâche DESIGN.md.
- [ ] Repo de la to-do existante — pas bloquant pour le socle, bloquant pour la feature `tasks`.
