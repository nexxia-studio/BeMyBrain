---
name: nexxia-seo
description: Méthode SEO + GEO « signature Nexxia » pour qu'un site public (vitrine, landing, fiche produit) soit trouvé sur Google, surtout en local BE/FR, et cité par les moteurs de réponse IA (AI Overviews, ChatGPT, Perplexity, Claude). Se déclenche quand on définit les pages d'un site, crée ou restructure une page publique, pose les données structurées, ou prépare une mise en ligne. Pas pour un écran d'app derrière login, un correctif de libellé, le SEA ni les campagnes. Complète nexxia-design.
---

# Nexxia SEO + GEO

Un site Nexxia est trouvé pour les requêtes que ses clients tapent, et cité quand ils posent la question à une IA. Les deux se gagnent avec le même matériau : des pages qui répondent directement, des faits vérifiables, une identité cohérente partout, et un HTML que les robots lisent sans JavaScript. La technique (metas, JSON-LD, sitemap, Lighthouse) est dans `.claude/rules/seo-vitrine.md` ; ce skill tient la méthode et les décisions.

## 1. Lecture SEO (au brief, avant la liste des pages)
Une ligne : **intention principale · zone · langue(s) · concurrent le mieux placé**. Exemple : « kiné et ostéo à Montzen et Plombières · fr-BE, de-BE en option · concurrent : cabinet X à Aubel ».
- Pattern local BE/FR : `prestation + commune` (« kiné Montzen »), `prestation + à proximité`, `prestation + problème` (« ostéopathe mal de dos »). Une page par intention, pas une page par mot-clé.
- Source des requêtes, dans l'ordre : Search Console si le site existe · Google à la main (navigateur Chrome : suggestions, « Autres questions posées », pack local, recherches associées, localisation BE) · Firecrawl search pour les concurrents (résultats organiques seulement) · ce que le client entend au téléphone. Pas d'outil payant par défaut. Résultat dans `docs/seo/requetes.md` (gabarit dans `docs/seo/`) ; **sans ce fichier, implementer et reviewer s'arrêtent et le demandent**.
- Multilingue : seulement si le client sert vraiment cette langue (Communauté germanophone, Flandre, France). Alors `hreflang` + une page traduite et adaptée, pas traduite mot à mot. Détail dans `references/local-be.md`.

## 2. Architecture : quelles pages, pourquoi
- Vitrine : accueil (intention large + zone) · une page par prestation (intention précise) · une page « à propos » ou équipe (entité, confiance, E-E-A-T) · contact et infos pratiques · FAQ si les questions sont nombreuses · mentions légales et confidentialité. 4 à 8 pages. Une page « zone » supplémentaire par commune secondaire **seulement** si elle a un contenu propre (adresse, témoignage de chantier, spécificité) ; sinon c'est du doublon pénalisé.
- Chaque page a un objectif unique : un `<h1>`, un `<title>`, un CTA. Deux pages qui visent la même intention = fusion.
- Maillage : chaque prestation pointe vers contact et vers une prestation voisine ; l'accueil pointe vers toutes les prestations ; le footer reprend NAP et horaires.

## 3. Contenu citable (le cœur du GEO)
Structure de chaque page ou section :
1. **Titre en question ou en intention** (`h2` : « Combien coûte une séance de kiné conventionnée ? »).
2. **Réponse directe en 1–2 phrases, 120–150 caractères**, juste sous le titre, autonome (un moteur découpe la page en passages ; chaque passage doit tenir seul).
3. **Faits vérifiables** : chiffres, durées, tarifs si le secteur l'autorise, dates, noms d'outils ou de méthodes. Viser 5 à 9 faits par page. Convention de source dans `references/geo.md` : fait opérationnel = `business.ts` ou `brief.md` ; statistique ou superlatif = URL publique ; sinon on retire.
4. Détail, puis **FAQ** de 3 à 6 questions formulées comme un client les dit, avec `FAQPage` JSON-LD.
5. **Date de mise à jour visible** et réelle ; contenu clé relu chaque trimestre.
Règles d'écriture : français naturel, phrases courtes, vocabulaire du client (pas du jargon métier sauf s'il est cherché), noms propres cohérents (même orthographe de l'entreprise, des personnes, des lieux partout). Interdits : pourcentages inventés, superlatifs non sourcés, pages « contenu pour le SEO » sans intérêt pour un humain. Détail et gabarits dans `references/geo.md`.

## 4. Identité et preuves hors site (ce que le code ne fait pas)
- **NAP identique** (nom, adresse, téléphone, format belge) sur : site, Google Business Profile, Pages d'Or, Trends Top, annuaires sectoriels, réseaux sociaux. Une seule version du nom, fixée dans `docs/brief.md`.
- **Google Business Profile** (le client propriétaire, Nexxia gestionnaire, vérification vidéo) : catégorie principale exacte, 10 photos réelles, horaires à jour, une publication par mois, réponse à chaque avis sous 24 h (santé : réponse type neutre). Avec Bing Places et Apple Business Connect. C'est ce que Google « Ask Maps » et les moteurs IA lisent en premier pour une recherche locale.
- **Avis** : demander après chaque prestation, viser du frais chaque mois. Secteur santé BE : on ne sollicite pas et on n'affiche pas de témoignages (règle de prudence Nexxia, détail dans `local-be.md`).
- **Liens locaux** : site de la commune, presse locale, club sponsorisé, association de commerçants, fédération professionnelle. Vingt bonnes citations valent mieux que deux cents.
Le client fait ces actions ; le kit lui prépare la liste. Détail dans `references/local-be.md`.

## 5. Lisibilité machine
- Le contenu qui compte est dans le HTML initial (Astro le fait par défaut ; en React, pas de contenu clé rendu uniquement côté client).
- Robots IA : les robots de recherche et citation ne sont jamais bloqués ; l'entraînement (`GPTBot`, `ClaudeBot`, `Google-Extended`) est un choix du client posé au brief. Liste unique et explication dans `references/geo.md`.
- `llms.txt` : gabarit dans `geo.md` ; usage par les moteurs non prouvé, dix minutes, pas sur Shopify.
- Données structurées : types et propriétés dans `.claude/rules/seo-vitrine.md`. Règle de fond : jamais de schema qui décrit ce qui n'est pas visible, jamais d'`aggregateRating` auto-attribué. Google n'exige aucun balisage pour ses réponses IA.

## 6. Mesure (mensuelle, 20 minutes)
- Search Console : requêtes, pages, positions ; propriété créée à la mise en ligne, sitemap soumis.
- Google Business Profile : appels, itinéraires, clics site.
- Search Console **et** Bing Webmaster Tools (Copilot, ChatGPT en partie) ; clé IndexNow dans `public/` pour Bing.
- Visibilité IA, à la main : 5 prompts fixes, protocole dans `geo.md` (fenêtre privée, Belgique, 3 passages). Tableau dans `docs/seo/suivi.md`. Outils payants seulement si le client a un budget.
- Analytics : sans cookie par défaut (Vercel Web Analytics, Plausible) ; GA4 seulement avec bandeau de consentement et Consent Mode v2 (APD / ePrivacy). Segment « IA » sur les référents listés dans `geo.md`.

## 7. Secteurs et limites
- Santé BE : information véridique, objective, vérifiable (loi qualité 2019, art. 31) ; pas de témoignages ni de comparatif ni de promotion par prudence déontologique. Le GEO reste possible : FAQ factuelles, déroulé d'une séance, conventionnement, accès.
- Cosmétiques : allégations encadrées (règlement 1223/2009) ; pas de promesse de résultat non prouvée.
- Shopify : fiches produit avec `Product` + `Offer` JSON-LD, collections avec texte propre, blog pour les intentions informationnelles ; sitemap à `/sitemap.xml`, pas de `llms.txt` à la racine (N/A). Le thème reste léger.
- Refonte d'un site existant : table de redirections 301 avant toute mise en ligne (`local-be.md`).
- Ce que ce skill ne fait pas : Google Ads, Meta Ads, campagnes e-mail, calendrier de contenu → skill SEA / marketing à part.
