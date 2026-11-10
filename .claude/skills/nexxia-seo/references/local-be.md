# SEO local — Belgique (et France voisine)

Sources (octobre 2026) : [ClickForest, SEO local en Belgique 2026](https://www.clickforest.com/fr/blog/seo-local-belgique), BrightLocal Local Consumer Review Survey 2026 (États-Unis, n ≈ 1 000, février 2026 : tendances, pas chiffres belges), doc Google Business Profile, Google « AI features and your website ».

## Contexte 2026
- AI Overviews actifs en Belgique depuis mars 2025, d'abord en anglais ; la part de requêtes NL/FR qui en déclenchent monte (ordre de grandeur rapporté par des agences belges : d'environ 3 % à 12–15 % en 2025, non vérifié indépendamment). Les requêtes locales transactionnelles (« kiné Montzen ») affichent surtout le pack local Maps ; les requêtes informationnelles déclenchent de plus en plus l'IA.
- 45 % des consommateurs disent utiliser un outil IA pour une recommandation locale (BrightLocal 2026, États-Unis).
- Google a remplacé les Questions-réponses de la fiche d'établissement (API retirée le 3 novembre 2025) par « Ask Maps », réponses générées par Gemini à partir du site, des avis et des attributs de la fiche. Les questions des clients vont donc dans la FAQ du site, et la fiche doit être complète.

## Google Business Profile (la pièce maîtresse)
- Catégorie principale exacte (« Kinésithérapeute », pas « Centre médical » ; « Institut de beauté », pas « Spa ») ; catégories secondaires pour les autres prestations.
- Nom = le nom légal ou commercial réel, sans mots-clés ajoutés (« G.Move », pas « G.Move Kiné Ostéo Montzen ») : Google suspend les fiches bourrées.
- 10 photos réelles minimum (façade, accueil, salle, équipe), renouvelées ; pas de banque d'images.
- Horaires exacts, horaires spéciaux pour les jours fériés belges.
- Une publication par mois (actualité, conseil saisonnier) : archivée après 6 mois.
- Attributs : accès PMR, parking, prise de RDV en ligne, langues parlées. Lien de prise de RDV si le client utilise un outil (Doctoranytime, Rosa, Progenda / Helena, Treatwell…).
- **Vérification** : le client crée la fiche avec son propre compte Google et reste propriétaire ; Nexxia est ajouté comme gestionnaire. Google demande une vérification par vidéo (la plus courante en 2026), parfois par courrier ou téléphone : filmer l'enseigne, l'intérieur, un document avec l'adresse. Cabinet qui se déplace à domicile sans accueil → fiche « zone desservie » avec adresse masquée. Avant de créer : chercher une fiche existante ou en doublon (anciennes fiches de praticiens, ancien nom) et la revendiquer ou la fusionner, sinon suspension.
- Faire la même chose sur **Bing Places** (import depuis Google possible) et **Apple Business Connect** : Copilot, Siri, Plans.

## Avis
- BrightLocal 2026 (États-Unis) : 47 % des consommateurs évitent une entreprise avec moins de 20 avis ; 74 % recherchent des avis datant des 3 derniers mois. Objectif : atteindre 20, puis du frais chaque mois.
- Routine : demander après chaque prestation (carte avec QR, SMS, e-mail), répondre à chaque avis sous 24 h, y compris les mauvais, sans dévoiler d'information sur la personne.
- **Santé** : le praticien ne sollicite pas d'avis et n'en affiche pas sur son site (prudence déontologique, voir ci-dessous). Les avis spontanés sur Google existent ; il y répond par une réponse type neutre, sans confirmer que la personne est patiente ni évoquer un soin.
- Jamais d'avis achetés ou rédigés par l'entreprise : Google en a retiré ou bloqué 292 millions en 2025 et détecte mieux les fraudes.

## Publicité et information des professionnels de santé (BE)
La loi qualité du 22 avril 2019, art. 31 (modifiée le 30 juillet 2022), encadre l'information professionnelle : elle doit être véridique, objective, pertinente, vérifiable, scientifiquement fondée, ne pas inciter à des soins inutiles, et mentionner le titre professionnel. Le texte n'interdit pas mot pour mot les témoignages, les comparatifs ou les promotions ; ces interdictions viennent de la déontologie (Ordre des médecins pour les médecins ; pour les kinés, ostéos, psychologues, il n'y a pas d'Ordre : fédérations comme Axxon, et SPF Santé publique) et de la jurisprudence. **Règle de prudence Nexxia** : pas de témoignages patients, pas de comparatif, pas de promotion tarifaire, information factuelle seulement ; en cas de doute, demander à la fédération du praticien ou au SPF Santé publique. Vérifier le texte consolidé avant de l'affirmer à un client.

## Inscriptions annuaires (NAP identique partout)
Ordre d'importance pour une PME wallonne ou germanophone :
1. Google Business Profile · 2. Bing Places · 3. Apple Business Connect · 4. Pages d'Or / Gouden Gids (pagesdor.be) · 5. Infobel · 6. Annuaire sectoriel : Doctoranytime (santé), Treatwell / Planity (beauté), Bobex ou annuaires de la Confédération Construction (bâtiment) · 7. Site de la commune (liste des commerçants ou prestataires) · 8. Facebook et Instagram (mêmes NAP et horaires) · 9. Fédération professionnelle (Axxon pour les kinés, UCM ; Unizo en Flandre) · 10. Trends Top (classement d'entreprises, faible valeur locale, en dernier).
Format NAP belge : `Rue Exemple 12, 4850 Montzen` · `+32 87 12 34 56` (international, espaces, pas de points). Une seule graphie du nom, fixée dans `docs/brief.md` et dans `src/data/business.ts`, reprise partout. Mentions légales : numéro BCE et numéro de TVA.
Vingt bonnes inscriptions cohérentes valent mieux que deux cents. Les incohérences (ancienne adresse, ancien numéro) se corrigent avant d'en créer de nouvelles.

## Liens locaux (les plus efficaces, et gratuits)
Site de la commune · presse locale (L'Avenir Verviers, Grenz-Echo pour l'est) · club sportif sponsorisé · association de commerçants · école ou maison de repos partenaire · fournisseurs et confrères (page « partenaires » réciproque, avec modération). Un article dans la presse locale vaut plus qu'une centaine d'annuaires.

## Pages « zone » : quand et comment
Une page par commune secondaire **seulement** si elle a un contenu propre : une seconde adresse, des visites à domicile sur cette commune, des chantiers ou références identifiables, un accès ou un public spécifiques. Sinon, la zone desservie est une section de l'accueil et le champ `areaServed` du JSON-LD. Dix pages « kiné + commune » quasi identiques = contenu dupliqué.
Photos : nom de fichier descriptif, `alt` et légende qui nomment la commune ; les coordonnées GPS dans l'EXIF n'ont aucun effet connu et Astro les retire de toute façon.

## Multilingue BE
- Français par défaut en Wallonie ; allemand pour la Communauté germanophone (Kelmis, Eupen, Raeren : réel pour un cabinet à Montzen) ; néerlandais seulement si le client sert la Flandre ou Bruxelles.
- Une langue = des pages traduites **et adaptées** (noms de lieux, formulations, conventionnement), URL en préfixe (`/de/`). La fiche Google est unique ; sa description peut être bilingue.
- `hreflang` : sur chaque page, une balise par version **y compris elle-même**, réciproques, plus `x-default` vers la langue principale ; codes `fr-BE`, `de-BE`, `nl-BE` (et `fr` seul si le site vise aussi la France). L'option `i18n` de `@astrojs/sitemap` génère les liens alternates dans le sitemap.
- Ne pas traduire par machine sans relecture : une page allemande approximative nuit plus qu'une absence.

## Refonte d'un site existant
Avant de toucher au contenu : exporter les URL actuelles (Search Console, sitemap, Firecrawl map), construire la table de redirections 301 ancienne → nouvelle dans `vercel.json`, garder les URL qui ont du trafic quand c'est possible. Après mise en ligne : Search Console → Pages → erreurs 404, pendant un mois.

## France voisine
Mêmes principes. Annuaires : Pages Jaunes, Doctolib (santé), Planity (beauté), Houzz / Travaux.com (construction). Format téléphone `+33 …`. Le pack local Google est plus concurrentiel ; les avis pèsent davantage.

## Checklist mise en ligne (à donner au client)
- [ ] Fiche Google Business Profile créée ou revendiquée par le client, Nexxia gestionnaire, vérifiée, catégorie exacte, 10 photos, horaires, lien site, lien RDV
- [ ] Bing Places et Apple Business Connect alignés
- [ ] Pages d'Or, Infobel, annuaire sectoriel : NAP identique
- [ ] Facebook / Instagram : NAP et horaires identiques, lien vers le site
- [ ] Search Console et Bing Webmaster Tools : propriétés vérifiées, sitemap soumis ; clé IndexNow dans `public/` (Bing, pas Google)
- [ ] Analytics : sans cookie (Vercel Web Analytics, Plausible) ou GA4 avec bandeau de consentement et Consent Mode v2 (obligation APD / ePrivacy en Belgique)
- [ ] Redirections 301 en place si refonte
- [ ] Demande de lien à la commune et à la fédération professionnelle
- [ ] Routine avis en place (hors santé) ou routine de réponse neutre (santé)
- [ ] 5 prompts IA de référence notés dans `docs/seo/suivi.md`, relevé à J+30
