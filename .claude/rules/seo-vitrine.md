---
paths:
  - "src/pages/**"
  - "src/layouts/**"
  - "src/content/**"
  - "src/data/**"
  - "src/components/seo/**"
  - "public/robots.txt"
  - "public/llms.txt"
  - "astro.config.*"
  - "vercel.json"
---
# Règles SEO et visibilité — sites vitrine BE/FR

<!-- Technique seulement. La méthode (intentions, pages, contenu citable, local, mesure) est dans le skill nexxia-seo. -->

- Une page = une intention de recherche locale : « kiné Montzen », « institut de beauté Verviers ». Le `<title>` (≤ 60 caractères) et le `<h1>` la contiennent, formulés pour un humain.
- Chaque page : `title`, `meta description` (≤ 155 caractères, avec un verbe d'action), `canonical`, `og:title`, `og:description`, `og:image` (1200×630, réelle), `lang="fr-BE"` (ou `fr-FR`).
- Données structurées JSON-LD : home → `LocalBusiness` ou son sous-type exact (`Physiotherapy`, `BeautySalon`, `MedicalBusiness`, `HomeAndConstructionBusiness`) avec `name`, `address` (format belge), `telephone` (+32…), `openingHoursSpecification`, `geo`, `areaServed`, `url`, `image`, `sameAs` (fiche Google, Facebook), `priceRange` seulement si le secteur l'autorise · page prestation → `Service` (`provider` = l'entreprise) · FAQ visible → `FAQPage` avec exactement les mêmes textes · praticien → `Person` avec `jobTitle` · toutes pages → `BreadcrumbList`. Un composant `<JsonLd>` par type dans `src/components/seo/`, alimenté par `src/data/business.ts` (source unique du NAP, BCE, TVA, horaires). `@id` : l'entreprise porte `#business`, `Service.provider` et `Person.worksFor` y renvoient. `hasMap` vers la fiche Google. Jamais d'`aggregateRating` auto-attribué.
- `site` défini dans `astro.config` sur le domaine final dès le premier jour. `@astrojs/sitemap` produit `sitemap-index.xml` (+ `sitemap-0.xml`) ; `robots.txt` est statique dans `public/`, déclare `Sitemap: https://<domaine>/sitemap-index.xml` et suit la liste de robots IA de `nexxia-seo/references/geo.md`. `llms.txt` statique selon le gabarit de `geo.md`. Clé IndexNow dans `public/`.
- Staging (`*.vercel.app`) : en-tête `X-Robots-Tag: noindex` via `vercel.json` tant que le domaine final n'est pas branché ; le contrôle SEO ≥ 90 se fait sur le domaine final.
- Refonte : table de redirections 301 dans `vercel.json` avant mise en ligne.
- Contenu de page : sous chaque `h2` en forme de question, une réponse directe de 120–150 caractères en premier paragraphe ; date « Mis à jour le … » réelle dans le layout, lue depuis le frontmatter.
- Images : `<Image>` Astro, `alt` descriptif en français, formats AVIF/WebP, dimensions déclarées (CLS). Nom de fichier parlant (`cabinet-kine-montzen-salle.jpg`), jamais `IMG_4821.jpg`.
- Un seul `<h1>` par page ; hiérarchie `h2`/`h3` sans saut. Les prestations sont des `h2` avec leur nom tel qu'un client le dirait.
- Liens internes : chaque page pointe vers la prise de contact ; le footer reprend adresse, téléphone cliquable (`tel:+32…`), horaires, mentions légales, politique de confidentialité.
- Performance visée : Lighthouse mobile ≥ 90 en Performance, Accessibilité, SEO. Vérifié dans `/qa` avant livraison.
- Secteur santé BE : pas de témoignages patients, pas de comparatif, pas de promo tarifaire, dans les metas non plus (règle de prudence, voir `nexxia-seo/references/local-be.md`).
- `hreflang` si multilingue : auto-référence, réciprocité, `x-default`, codes `fr-BE` / `de-BE` / `nl-BE` ; option `i18n` de `@astrojs/sitemap`.
