# [NOM DU PROJET]

<!-- ≤ 100 lignes. Chaque ligne doit répondre oui à : « si je la retire, Claude se trompe ? » -->
<!-- Le détail vit dans docs/ et .claude/rules/ (chargés à la demande), pas ici. -->

## Contexte
- [Une phrase : ce que fait le produit, pour qui.]
- Client / produit Nexxia : [Studio (site client) | Labs (produit)].
- Langue : code et identifiants en anglais ; noms de tests, docs, commits et réponses en français.
- Interlocuteur : Antoine, fondateur, profil technique. Pas d'explications de base, pas de jargon corporate.

## Stack
<!-- Garder UNE ligne par profil, supprimer les autres. -->
- Profil SaaS / app web : React 18 + TypeScript + Vite, Tailwind + shadcn/ui, TanStack Query, React Router v6, Supabase (Postgres, Auth, Storage, Edge Functions Deno), [Stripe | Mollie].
- Profil site vitrine : Astro [ou Next], Tailwind, formulaires via [Resend | Edge Function], pas de base de données.
- Profil mobile : Expo + React Native, backend = l'API du SaaS (pas de règles backend ici).
- Package manager : pnpm. Déploiement : Vercel. Tests : Vitest + Playwright.
- Commandes : `pnpm dev` · `pnpm test` · `pnpm vitest run <fichier>` · `pnpm lint` · `pnpm typecheck` · `pnpm e2e`

## Constitution (non négociable)
1. Une session = une feature. Nouvelle feature → `/clear` puis `/feature <nom>`. Le plan entier s'exécute dans cette session via `subagent-driven-development` ; ce sont les sous-agents qui portent le contexte, pas la session.
2. Rien ne se code sans spec. Specs et plans vivent dans `docs/features/<nom>/` (spec.md, plan.md), pas dans `docs/superpowers/`.
3. TDD (skill `test-driven-development`). Pas de code sans test correspondant.
4. Fini = `reviewer` OK + `/qa` OK. « Ça devrait marcher » n'est pas un état.
5. Multi-tenant : toute table métier porte `gym_id NOT NULL` + RLS. Jamais de requête sans filtre tenant. [adapter / supprimer si pas de backend]
6. Argent en entiers `_cents`. Enums → CHECK constraints. Jamais de float monétaire.
7. Pas de nouvelle dépendance sans justification dans le plan. Pas de couche d'abstraction « au cas où ».
8. Secrets uniquement en variables d'environnement. Jamais dans le code, les docs ou les commits.

## Workflow
0. Nouveau client Studio : `/brief-client <nom> <url>` d'abord (Firecrawl → brief, questions, curseurs design).
1. `/feature <nom>` : `explorer` cartographie l'existant (via Graphify si `graphify-out/` existe) → `brainstorming` → spec → `writing-plans` → plan.
2. Exécution : `subagent-driven-development` en dispatchant **`subagent_type: implementer`** pour chaque tâche et **`subagent_type: reviewer`** pour chaque review, à la place des prompts par défaut du skill. L'implementer commit sur la branche de feature ; le reviewer relit `git diff <base>..HEAD`.
3. Tâche marquée `[security]` dans le plan → dispatcher `security-auditor` après le reviewer. Rien ne le lance automatiquement.
4. `/qa <nom>` quand le plan est fini : `qa-tester` joue les scénarios de la spec dans le navigateur.
5. `/handoff` en fin de session : `scribe` met à jour docs/ et donne la commande de reprise.
6. Agents sans Bash restrictif : « lecture seule » est une convention écrite dans chaque agent, pas une barrière technique. Les commandes destructives sont bloquées dans `.claude/settings.json`.

## Docs (lire avant d'agir, mettre à jour après)
- Index : @docs/README.md
- État courant et prochaine étape : @docs/handoff.md
- Pièges connus : @docs/gotchas.md
- Architecture : docs/architecture.md · Décisions : docs/decisions/ · Specs : docs/features/
- Règles par zone de code : .claude/rules/ (chargées automatiquement selon le fichier touché)

## SEO et visibilité IA [supprimer si app derrière login]
- Méthode : skill `nexxia-seo` (se déclenche seul ; intentions → pages, contenu citable, local BE, mesure). Technique : `.claude/rules/seo-vitrine.md`. Requêtes et pages : `docs/seo/requetes.md` (obligatoire avant toute page).
- Une page = une intention. Réponse directe sous chaque titre-question. Statistique ou superlatif sans source = bloqué. NAP unique dans `src/data/business.ts`.
- Audit : `/seo-audit <url>` avant mise en ligne puis chaque trimestre. SEA et campagnes : hors kit (skill à part).

## Design
- Charte : DESIGN.md (Impeccable). Contexte produit : PRODUCT.md. Méthode et goût : skill `nexxia-design` (se déclenche seul ; méthode, curseurs, sourcing, `references/anti-slop.md`). Ne jamais inventer une couleur ou une police hors DESIGN.md.
- Une bibliothèque d'animation par arbre (table du § 5 de `nexxia-design`). Avant de livrer une UI : anti-slop puis `/impeccable critique`.

## Format des réponses
- Antoine est technique mais lit en responsable produit : réponses ≤ 10 lignes hors code, vocabulaire produit, le détail technique va dans les fichiers ou sur demande.
- Action d'abord, justification après. Pas de préambule, pas de récapitulatif de la demande, pas de conclusion.
- Restituer l'état courant en une ligne quand une tâche s'étale sur plusieurs tours ; une seule prochaine étape à la fin.
- Proposer 2–3 options avec un avis tranché quand un choix structure la suite (archi, design, périmètre). Sinon, faire.
- Signaler une incohérence de schéma ou de plan AVANT de construire dessus.

## Contexte et compaction
- Après deux corrections ratées sur le même point : `/clear`, reformuler, repartir de la spec.
- En compactant, toujours conserver : la liste des fichiers modifiés, la tâche en cours du plan, les tests rouges.
