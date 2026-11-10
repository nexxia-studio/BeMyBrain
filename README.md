# Nexxia Claude Kit

Structure de travail Claude Code pour les repos Nexxia : un CLAUDE.md court, des règles chargées à la demande, 6 agents dédiés, 6 commandes, deux skills de méthode (design, SEO + GEO), et une documentation qui survit aux sessions.

Ce kit s'ajoute **par-dessus** des outils externes : superpowers (workflow), Impeccable (charte design), GSAP skills (animation), Firecrawl (web → markdown), quatre skills d'Emil Kowalski, Playwright CLI (QA) et Graphify (graphe de code). Il ne les remplace pas.

## Contenu

```
CLAUDE.md                      ← ≤ 100 lignes : contexte, stack, constitution, workflow, imports
.claude/
  settings.json                ← permissions.deny (push --force, .env, db push) + hook prettier/eslint
  rules/                       ← règles chargées seulement quand un fichier du chemin est touché
    supabase.md                   supabase/**, *.sql
    frontend.md                   src/**, app/**
    tests.md                      *.test.*, e2e/**
    seo-vitrine.md                src/pages/**, public/** : metas, JSON-LD local, sitemap, llms.txt, Lighthouse
  agents/                      ← un sous-agent = une responsabilité, contexte vide à chaque appel
    explorer.md                   analyse de l'existant (lecture seule, haiku, Graphify si présent)
    implementer.md                une tâche du plan, TDD, échelle de simplicité, commit sur la branche
    reviewer.md                   review en 2 passes : spec puis qualité (+ anti-slop si UI)
    security-auditor.md           RLS, tenant, paiements, secrets — base locale uniquement
    qa-tester.md                  scénarios dans un vrai navigateur (Playwright CLI)
    scribe.md                     met à jour docs/ (handoff, gotchas, ADR)
  skills/                      ← commandes slash et skills
    brief-client/                 /brief-client <nom> <url> : Firecrawl → brief, questions, curseurs
    feature/                      /feature <nom>  : explorer → spec → plan
    qa/                           /qa <nom>       : scénarios E2E + rapport
    handoff/                      /handoff [focus] : clôture de session, skills pour la suite
    decision/                     /decision <titre> : ADR
    nexxia-design/                skill auto : lecture du brief, 3 curseurs, verrous, sourcing composants
    nexxia-seo/                   skill auto : intentions → pages, contenu citable (GEO), local BE, mesure
      references/geo.md             ce qui fait citer une page par les IA (Princeton, tableau 1), robots IA, convention de source, gabarits, protocole de mesure
      references/local-be.md        fiche Google (vérification), avis, loi qualité art. 31, annuaires belges, hreflang, redirections, analytics et consentement
      references/keywords.md        recherche de requêtes sans outil payant, de la requête au titre
    seo-audit/                    /seo-audit <url> : technique + contenu + local + IA → rapport et plan
      references/presets.md         curseurs par type de projet Nexxia
      references/motion.md          physique du mouvement (apple-design), squelettes GSAP
      references/anti-slop.md       liste de contrôle avant livraison UI
docs/
  README.md · handoff.md · gotchas.md · architecture.md · instructions-projet-claude-ai.md
  seo/requetes.md (gabarit) · seo/suivi.md (gabarit)
.gitignore                     ← à fusionner avec celui du repo
  decisions/ADR-000-template.md
  features/_template/{spec,plan}.md
```

## Démarrer un projet depuis ce repo
Ce repo est marqué *template* : sur GitHub, « Use this template » → nouveau repo `<client>` (privé, sous `nexxia-studio`). Puis ajoute le scaffold (Astro, Next ou Expo) dedans et suis « Adapter les crochets ». Un repo existant : copie `.claude/`, `docs/`, `CLAUDE.md`, `.gitignore`.

## Installation sur un repo existant (≈ 30 min)

### 0. Prérequis
Node 22+ (Lighthouse 13 ; sinon `lighthouse@12`), pnpm, git, `jq` (hook et scores Lighthouse : `brew install jq`), Claude Code à jour, `uv` (Graphify).

### Plugins : ce que le repo peut et ne peut pas faire
`.claude/settings.json` déclare `enabledPlugins` (superpowers, firecrawl, gsap-skills) et la marketplace GSAP. Ça **n'installe rien tout seul** : sur ton Mac, Claude Code affichera « enabled in project settings but isn't installed » dans `/plugin` → Errors tant que tu n'as pas fait l'étape 1 ; les sessions Claude Code **cloud** ignorent cette déclaration (doc officielle). Donc : étape 1 une fois par machine ; en cloud, le kit tourne sans superpowers (agents, skills, rules et hooks du repo sont lus), et `/feature` te le dira si `brainstorming` ou `writing-plans` manquent.

### 1. Outils globaux (une fois par machine)
Dans un terminal :
```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills -g                        # skill qa-tester, dispo partout
playwright-cli install-browser
uv tool install graphifyy                                 # graphe de code

# Skills d'Emil Kowalski, en global, seulement ceux-là
npx skills@latest add emilkowalski/skills --skill apple-design -g -a claude-code -y
npx skills@latest add emilkowalski/skills --skill animate-expo -g -a claude-code -y
npx skills@latest add emilkowalski/skills --skill mobile-native -g -a claude-code -y
npx skills@latest add emilkowalski/skills --skill break-ui -g -a claude-code -y
```
Puis dans une session `claude` (n'importe quel dossier) :
```
/plugin install superpowers@claude-plugins-official       # workflow
/plugin marketplace add greensock/gsap-skills
/plugin install gsap-skills@gsap-skills                   # animation
/plugin install firecrawl@claude-plugins-official         # web → markdown (brief-client)
/reload-plugins
/firecrawl:setup                                          # clé API gratuite, sans CB
```
Impeccable s'installe **par repo** (étape 4) : son DESIGN.md est propre à chaque projet.

### 2. Copier le kit dans le repo
```bash
cp -r nexxia-claude-kit/.claude  <repo>/
cp -r nexxia-claude-kit/docs     <repo>/
cp nexxia-claude-kit/CLAUDE.md   <repo>/CLAUDE.md   # fusionner si un CLAUDE.md existe déjà
```
CLAUDE.md déjà long ? Le ranger dans `docs/legacy-claude.md`, repartir du modèle, ne remonter que ce qui fait échouer Claude s'il manque.

### 3. Adapter les crochets `[…]`
- `CLAUDE.md` : nom, une seule ligne de stack (SaaS / vitrine / mobile), commandes pnpm, clé tenant.
- `.claude/rules/` : supprimer `supabase.md` sur un site vitrine, `seo-vitrine.md` sur une app ; `frontend.md` a une note d'adaptation en tête.
- `.gitignore` : fusionner avec celui du repo si un existe déjà.
- `docs/architecture.md` : « Remplis docs/architecture.md à partir du code » à l'agent `explorer`.
- `docs/gotchas.md` : supprimer les lignes qui ne s'appliquent pas.

### 4. Design (projets avec UI)
```bash
npx impeccable install        # skills + commandes + hook détecteur
```
puis `/impeccable init` (PRODUCT.md) et `/impeccable document` (DESIGN.md). Site client : DESIGN.md = la charte du client. Ajouter `.playwright-cli/` et `qa-screenshots/` au `.gitignore`.

### 5. Graphify (Viniz, et tout repo > ~150 fichiers)
Dans le repo : `graphify install` puis `/graphify .` dans Claude Code (voir le README du dépôt pour les commandes exactes). Commiter `graphify-out/`. L'agent `explorer` l'utilise automatiquement.

### 6. Vérifier
`/context` (CLAUDE.md + 3 docs importés, pas les rules) · `/agents` (6 agents) · `/skills` (brief-client, feature, qa, handoff, decision, seo-audit + nexxia-design, nexxia-seo).

## Playbooks — quelle commande dans quelle situation

| Situation | Première commande | Puis | Ce que tu valides toi-même |
| --- | --- | --- | --- |
| **Site vitrine client** (Julie Meessen, G.Move) | `/brief-client <nom> <url>` (inclut requêtes et pages via `nexxia-seo`) | `/impeccable init` → logo reçu → `/impeccable document` → `/feature home` → exécuter le plan → `/qa home` → `/seo-audit` avant mise en ligne → `/handoff` | Le brief et les 3–5 questions client · la lecture du brief + curseurs · DESIGN.md · la home sur ton téléphone avant les pages suivantes |
| **Viniz, nouvelle feature** | `/clear` puis `/feature <nom>` | plan via `subagent-driven-development` (implementer / reviewer) · `security-auditor` sur chaque `[security]` · `/qa <nom>` · `/handoff` | La spec (questions du brainstorming) · le verdict du reviewer sur la tâche 1 · le rapport QA |
| **Viniz, bug** | `/clear` puis « explorer : où est géré <symptôme> ? » | skill `systematic-debugging` (superpowers) → un `implementer` pour le correctif + test de non-régression → `reviewer` | La cause racine avant le correctif |
| **Dopamine, écran mobile** | maquette Claude Design, puis `/feature <ecran>` | `nexxia-design` (preset mobile 5/5/5) + `apple-design` + `animate-expo` pendant l'implémentation · `break-ui` · `/qa` sur le build web Expo avec device iPhone | La maquette avant le code · l'écran codé sur ton téléphone réel |
| **nexxia.pro** | `/brief-client nexxia aucun agence` puis `/impeccable init` + `document` | preset agence 9/8/3 · GSAP ScrollTrigger · React Bits uniquement en variante GSAP · `/feature` section par section | Chaque section au ralenti (DevTools → Animations) |
| **Boutique Shopify (thème)** | repo du thème + profil vitrine | `/feature <section>` · `nexxia-design` preset Shopify 5/3/5 · `/qa` sur l'URL preview du thème | Fiche produit et panier en mobile |
| **Boutique Shopify (catalogue, contenu, MCP)** | pas Claude Code : Projet claude.ai de la marque | un doc « conventions boutique » + un doc « journal » tenus en fin de conversation · Firecrawl pour les fiches fournisseurs | Une conversation = une tâche, comme ici |
| **Site client existant** (Julie Meessen, boutiques HElo) | `/seo-audit <url> <client> <prestation> <commune>` | rapport dans `docs/seo/` → `/feature seo-<trimestre>` pour les corrections structurelles · checklist côté client (fiche Google, annuaires) | Les 3 constats les plus coûteux · les prompts IA à la main une fois par mois |
| **Landing Viniz, thème Shopify (sans `/brief-client`)** | `/seo-audit <url>` ou un brief léger qui crée `docs/seo/requetes.md` depuis le gabarit | puis `/feature` normalement ; sans `requetes.md`, implementer et reviewer s'arrêtent | La liste des intentions avant la première page |
| **Fin de journée, n'importe quel repo** | `/handoff [focus de demain]` | — | La commande de reprise affichée |

## Mise en ligne (sites vitrine)
1. `git push` sur GitHub (`gh repo create nexxia-studio/<client> --private --source=. --push`).
2. Vercel : importer le repo (framework détecté), domaine temporaire `<client>.vercel.app` = staging à montrer au client, **avec `X-Robots-Tag: noindex` dans `vercel.json`** tant que le domaine final n'est pas branché (l'alias de production est indexable).
3. Domaine final : acheté chez Hostinger ou Vercel ; DNS chez Hostinger → enregistrement `A` / `CNAME` vers Vercel ; e-mail pro reste chez Hostinger (voir `docs/gotchas.md` : POP3 et redirection).
4. Après mise en ligne : Search Console (propriété + sitemap), Bing Webmaster Tools, Google Business Profile et annuaires alignés (checklist de `nexxia-seo/references/local-be.md`), 5 prompts IA de référence notés dans `docs/seo/suivi.md`, et un `/decision` « site en production le <date> ».
5. Trimestriel : `/seo-audit <url>` ; relevé des 5 prompts ; mise à jour datée des pages clés.

## Règles de contexte
- Une session = une feature ; `/clear` entre deux features. Deux corrections ratées sur le même point → `/clear`, reformuler, repartir de la spec.
- `/context` quand ça ralentit : si CLAUDE.md + imports dépassent ~15 % de la fenêtre, quelque chose a grossi qui ne devrait pas.
- Les agents « lecture seule » le sont par convention écrite, pas par restriction d'outil (Claude Code n'applique pas les patterns `Bash(...)` dans `tools:`). Les commandes destructives sont bloquées pour tous dans `settings.json` → `permissions.deny`.

## Ce que le hook fait
Après chaque `Edit`/`Write` sur un `.ts/.tsx/.js/.jsx/.astro` : Prettier puis ESLint `--fix`. Si ESLint échoue, les 20 dernières lignes remontent à Claude comme feedback. Rien au `Stop` : `/handoff` reste à ta main.

## Qui fait quoi : kit vs skill `pme-vitrine-designer`
Le skill `pme-vitrine-designer` de ton compte claude.ai couvre le même terrain (Astro / Vercel, charte, SEO + GEO, llms.txt) pour les démos et le cadrage **en chat**. Dans un repo, c'est le kit qui fait foi (`nexxia-design`, `nexxia-seo`, `seo-vitrine.md`) ; ne charge pas les deux ensemble, leurs règles divergent sur les détails.

## Sources intégrées (et ce qu'on en a pris)
superpowers (workflow, TDD, sous-agents) · spec-kit (constitution, spec par feature) · article Laravel (rules par chemin) · Playwright CLI (QA) · Impeccable (DESIGN.md, détecteur) · Taste Skill v2 (lecture du brief, curseurs, anti-slop, pre-flight) · apple-design d'Emil (physique du mouvement) · GSAP skills (squelettes, cleanup) · React Bits et 21st.dev (sourcing de composants) · Ponytail (échelle de simplicité) · handoff de Matt Pocock (référencer, skills pour la suite, redaction) · i-have-adhd (réponses courtes, action d'abord) · Firecrawl (brief-client) · Graphify (explorer) · Princeton GEO, Search Engine Land et Erlin 2026, ClickForest et BrightLocal 2026 (nexxia-seo).
