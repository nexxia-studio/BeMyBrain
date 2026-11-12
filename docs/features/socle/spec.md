# Spec — Socle

**Créée le** : 2026-11-10 · **Statut** : validée (questions tranchées le 2026-11-11) · **Plan** : `plan.md`

## Objectif
Antoine se connecte à BeMyBrain en production et arrive sur un tableau de bord bento vide mais réel, où il bascule entre Privé et Pro (Trustup, Nexxia). Tous les modules suivants se posent dessus sans retoucher les fondations.

## Hors périmètre
- Tout module métier (to-do, listes, finance…).
- Inscription publique, abonnement, paiement, invitation d'un deuxième compte.
- Assistant IA, Umami, application mobile.
- Création de l'environnement staging (ADR-005 : prêt à brancher, pas créé).
- Mode hors ligne et service worker (ADR-008). App native Expo (BRAIN-28).
- Traduction du contenu saisi par l'utilisateur (ADR-007). Langues autres que français et anglais.

## Critères d'acceptation
- [ ] Quand un visiteur non connecté ouvre n'importe quelle page de l'app, alors il est renvoyé vers l'écran de connexion.
- [ ] Quand Antoine se connecte avec ses identifiants, alors il arrive sur le tableau de bord de son workspace.
- [ ] Quand la base est créée à neuf, alors les migrations produisent `workspaces`, `workspace_members`, `contexts`, et un script de départ crée le workspace d'Antoine avec les contextes Privé, Trustup et Nexxia.
- [ ] Quand Antoine choisit Privé ou Pro, alors le tableau de bord n'affiche que les tuiles de ce côté, et le choix est conservé au rechargement.
- [ ] Quand Antoine est côté Pro, alors il peut filtrer sur Trustup, Nexxia ou les deux.
- [ ] Quand un utilisateur d'un autre workspace interroge la base, alors il ne lit ni ne modifie aucune ligne du workspace d'Antoine, même si le filtre applicatif est retiré (test automatisé au niveau de la base, RLS active).
- [ ] Quand une table métier est créée, alors la même migration active la RLS et pose ses policies.
- [ ] Quand l'app répond à une requête utilisateur, alors elle utilise le rôle restreint, jamais le rôle propriétaire.
- [ ] Quand une pull request est ouverte, alors Vercel publie une preview reliée à sa propre branche Neon, et lint, typecheck et tests passent.
- [ ] Quand on cherche une URL ou un identifiant d'environnement dans le code, alors on n'en trouve aucun : tout est dans les variables listées dans `.env.example`.
- [ ] Quand la base de production est restaurée à un instant passé sur une branche de test, alors les données d'Antoine y sont lisibles (restauration vérifiée une fois).
- [ ] Quand l'app est ouverte sur mobile, alors la grille bento passe en une colonne et la navigation reste utilisable au pouce.
- [ ] Quand `prefers-reduced-motion` est actif, alors aucune animation décorative ne joue (Motion et GSAP).
- [ ] Quand Antoine répète un geste (bascule Privé / Pro, filtre, navigation), alors la réponse est instantanée : aucun moment signature ne rejoue (ADR-006).
- [ ] Quand un élément est animé, alors il l'est par Motion ou par GSAP, jamais par les deux ; GSAP n'est pas dans le bundle initial (ADR-006).
- [ ] Quand Antoine choisit l'anglais dans ses réglages, alors toute l'interface passe en anglais, le choix est conservé d'un appareil à l'autre, et l'URL ne change pas (ADR-007).
- [ ] Quand une date, un nombre ou un montant s'affiche, alors il est formaté selon la langue choisie.
- [ ] Quand un texte d'interface est écrit en dur dans un composant, ou qu'une clé manque dans une des deux langues, alors un test automatisé échoue.
- [ ] Quand Antoine ouvre l'app dans Safari iOS ou Chrome Android, alors il peut l'ajouter à l'écran d'accueil et elle s'ouvre en plein écran, avec son icône et son nom (ADR-008).
- [ ] Quand une erreur se produit en production, alors elle apparaît dans Sentry et une alerte arrive dans le canal Slack choisi, sans donnée personnelle dans l'événement.
- [ ] Quand Antoine ouvre la palette de commandes (⌘K, ou bouton sur mobile), alors il peut naviguer et lancer les actions du registre ; une action aux paramètres invalides ne s'exécute pas (ADR-009).
- [ ] Quand on lit le registre d'actions, alors chaque action déclare nom, description, paramètres validés et lecture ou écriture, et le registre n'importe ni React ni Next (ADR-009).
- [ ] Quand on cherche une règle métier dans `src/components/` ou `src/app/`, alors on n'en trouve aucune : elle est dans `src/modules/` (ADR-008).

## Scénarios utilisateur (joués par /qa)
1. **Première connexion** — Antoine part de l'URL de production, se connecte, obtient le tableau de bord avec ses contextes. Variante mobile : oui.
2. **Bascule Privé / Pro** — Antoine part du tableau de bord, passe en Pro, filtre sur Nexxia, recharge la page, retrouve le même état. Variante mobile : oui.
3. **Accès refusé** — un visiteur non connecté ouvre une URL interne, obtient l'écran de connexion et rien d'autre. Variante mobile : non.
4. **Changer de langue** — Antoine ouvre ses réglages, passe en anglais, voit toute l'interface en anglais avec dates et nombres au format anglais, recharge, se reconnecte : l'anglais est conservé. Variante mobile : oui.
5. **Installer l'app** — sur mobile, le navigateur propose l'ajout à l'écran d'accueil (manifeste valide, icônes présentes, affichage plein écran). Variante mobile : oui uniquement. Pour `/qa` : sur la preview HTTPS, iPhone (Safari) et Android (Chrome) ; vérifier le plein écran iOS (sinon `apple-mobile-web-app-capable` via `metadata.other`).
6. **Palette de commandes** — Antoine ouvre la palette, cherche « langue », lance le changement vers l'anglais : l'interface passe en anglais. Variante mobile : oui (bouton).

## Données et sécurité
- Tables touchées : `workspaces`, `workspace_members` (dont `locale`, ADR-007), `contexts` (nouvelles), plus les tables de l'auth retenue.
- Isolation : double verrou selon ADR-002 — RLS sur chaque table + filtre `workspace_id` dans `src/modules/core/`.
- Auth : Managed Better Auth de Neon (ADR-003), connexion par e-mail. Pas d'inscription publique : le compte d'Antoine est créé à la main.
- Environnements : production + previews (ADR-005).
- Argent / paiement concerné : non. Les tâches d'auth, de session et de RLS sont marquées `[security]`.

## UI
- Écrans concernés : connexion, coque (navigation, bascule Privé / Pro, filtre de contexte, palette de commandes), tableau de bord bento avec tuiles vides, réglages (langue).
- Maquette : aucune. Références : `docs/design/references/finance-glass.webp` et `maison-bento.webp`.
- Contraintes : DESIGN.md et PRODUCT.md à produire en première tâche (Impeccable + skill `nexxia-design`). Direction liquid glass, grille bento. Animation : Motion pour les interactions, GSAP pour les moments signature (ADR-006). Textes en FR/EN (ADR-007). Mobile d'abord, installable (ADR-008).

## Questions ouvertes
Tranchées le 2026-11-11 avec Antoine ; détail dans `plan.md`, § « Décisions prises dans ce plan ».
- [x] Transmission de l'identité à la base pour la RLS → jeton de Neon Auth, vérifié côté serveur puis injecté dans la transaction ; les policies lisent `auth.user_id()`.
- [x] Nom de domaine de production → sous-domaine Vercel pour le socle ; domaine dédié plus tard, sans changement de code.
- [x] Thème → clair d'abord (référence visuelle validée par Antoine le 2026-11-12 : verre dépoli clair sur brume bleu-lilas), couleurs en tokens pour ajouter le sombre plus tard. Remplace « sombre d'abord » du 2026-11-11.
- [x] Repo de la to-do existante → `nexxia-studio/todo-perso-pro` sur GitHub, à cartographier au `/feature tasks`.
