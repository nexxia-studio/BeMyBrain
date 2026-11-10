---
name: seo-audit
description: Audit SEO + GEO d'un site existant ou d'un site prêt à mettre en ligne — technique, contenu citable, local, visibilité IA — avec un plan d'actions classé par effort et impact. À lancer sur un site client existant (Julie Meessen, boutiques HElo), avant une mise en ligne, puis tous les trimestres.
argument-hint: "<url> [client] [prestation principale] [commune]"
disable-model-invocation: true
---

Audit de : **$ARGUMENTS**

Applique le skill `nexxia-seo`. Quatre volets, un rapport, un plan. Rien n'est corrigé dans cette session : chaque action devient une tâche.

## 1. Technique (15 min)
- Firecrawl map de l'URL → liste des pages, profondeur, orphelines, doublons apparents.
- Pour la home et 3 pages clés : `title`, `meta description`, `h1` unique, `canonical`, `lang`, `og:*`, JSON-LD présent et valide (`LocalBusiness` sous-type exact, `Service`, `FAQPage`, `BreadcrumbList`), images avec `alt`, poids.
- `robots.txt` (robots de recherche IA non bloqués, `Sitemap:` déclaré), sitemap (`sitemap-index.xml` sur Astro, `sitemap.xml` sur Shopify / Next), `llms.txt` (N/A sur Shopify), clé IndexNow : présents, cohérents.
- Lighthouse mobile : `npx lighthouse@12 <url> --only-categories=performance,accessibility,seo --quiet --chrome-flags="--headless=new" --output=json --output-path=docs/seo/lighthouse-$(date +%F).json` puis `jq '.categories|map_values(.score)'`. Node 22 requis pour lighthouse 13 ; sinon épingler 12. Sur un staging protégé ou en `noindex`, le score SEO n'a pas de sens : le noter et refaire sur le domaine final.
- Site en JavaScript lourd : vérifier que le contenu clé est dans le HTML initial (`curl -s <url> | grep` un texte de la page).

## 2. Contenu citable (15 min)
Pour la home et chaque page prestation : titre-question ou intention ? réponse directe sous le titre ? nombre de faits vérifiables (viser 5–9) ? FAQ présente et en JSON-LD ? date de mise à jour visible et plausible ? vocabulaire client ou jargon ? Une page = une intention ou plusieurs pages se marchent dessus ?
Compare aux requêtes de `docs/seo/requetes.md` si le fichier existe ; sinon, fais une collecte rapide (`nexxia-seo/references/keywords.md`, 10 requêtes) et crée-le à partir du gabarit `docs/seo/requetes.md`. Site existant qui va être refondu : exporte la liste des URL actuelles pour la table de redirections.

## 3. Local (10 min)
- Fiche Google Business Profile : existe ? doublon ? catégorie ? nombre d'avis et date du dernier ? photos ? horaires ? lien site ? (Google à la main dans Chrome, pack local ; Firecrawl ne le renvoie pas.) Bing Places, Apple Business Connect : présents ?
- NAP : compare site, fiche Google, Pages d'Or, Infobel, annuaire sectoriel, Facebook. Note chaque divergence.
- Liens entrants locaux visibles (commune, presse, fédération) : oui / non.

## 4. Visibilité IA (10 min)
Les 5 prompts de référence et le protocole de `nexxia-seo/references/geo.md` (fenêtre privée, BE, 3 passages). En pratique Antoine le fait à la main dans ChatGPT, Perplexity, AI Mode : prépare-lui les prompts remplis et le tableau vide dans `docs/seo/suivi.md`. Pour chacun : client cité (x/3) ? concurrents cités ? erreur factuelle ?

## 5. Rapport → `docs/seo/audit-<AAAA-MM>.md`
```
# Audit SEO + GEO — <client> — <date>
Scores Lighthouse mobile : Perf xx · A11y xx · SEO xx
## Ce qui marche (3–5 lignes)
## Constats
| # | Volet | Constat | Preuve (URL, capture, prompt) | Impact | Effort |
## Plan d'actions
### Gains rapides (< 1 h chacun, cette semaine)
### Structurel (une tâche de plan par item)
### Côté client (fiche Google, avis, annuaires : checklist de local-be.md)
## Suivi IA
| Prompt | ChatGPT | Perplexity | AI Mode | Concurrents cités |
```
Impact et effort en trois niveaux (fort / moyen / faible). Les gains rapides passent en tête. Les actions « structurel » deviennent des tâches dans `docs/features/seo-<trimestre>/plan.md` via `/feature` si Antoine valide.

## 6. Fin
Affiche les scores, les 3 constats les plus coûteux et la première action de chaque liste. Propose : `/feature seo-<trimestre> "corrections de l'audit du <date>"` et, si des points concernent le design, `/impeccable critique`.
