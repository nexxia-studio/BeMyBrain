---
name: brief-client
description: Démarre un site vitrine client — récupère le site actuel et 2–3 concurrents locaux avec Firecrawl, en tire un brief (services, ton, preuves, manques) et prépare PRODUCT.md, la lecture design et les curseurs. À lancer avant /feature sur un nouveau projet Studio.
argument-hint: "<nom-client> <url-site-actuel ou 'aucun'> [secteur] [ville]"
disable-model-invocation: true
---

Client : **$ARGUMENTS**

Objectif : en 45 minutes, passer d'une URL à un brief exploitable, sans qu'Antoine ait à retaper ce qui existe déjà. Utilise les outils Firecrawl du plugin (map, scrape, search). S'ils ne sont pas disponibles, repli : `WebFetch` page par page, et dis-le ; en dernier recours demande à Antoine de coller le contenu.

## 1. Collecte
1. Site actuel (si fourni) : map pour la structure, puis scrape de la home et des 3–5 pages clés. Note : pages, services, tarifs affichés, ton, coordonnées, horaires, avis cités, photos (réelles ou banque).
2. **Branche « aucun »** (pas de site, ou seulement Facebook / Instagram, que les outils ne peuvent pas lire) : ne tente pas de scraper les réseaux sociaux. Fais d'abord l'étape concurrents, puis interviewe Antoine en une seule salve de 8 questions max : activité exacte et spécialités · zone et clientèle · ce qui les différencie · prise de contact / RDV (téléphone, outil en ligne, lequel) · horaires et adresse · équipe · contenus disponibles (logo, photos, textes) · objectif du site. Antoine peut répondre pour le client ; note ce qui reste « à confirmer ».
3. Concurrents : search « <secteur> <ville> » et les communes voisines → 2–3 sites locaux. Scrape leur home uniquement. Note ce qu'ils font mieux et ce qu'ils ratent.
4. Ne stocke aucune donnée personnelle de clients finaux (témoignages avec nom complet, e-mails) : résume, ne copie pas.
5. **Secteur santé en Belgique** (kiné, ostéo, médecin, dentiste, psy) : l'information professionnelle est encadrée (loi qualité du 22 avril 2019, art. 31 : véridique, objective, vérifiable) ; par prudence Nexxia n'écrit ni témoignages de patients, ni comparatif, ni promotion tarifaire. Le formulaire de contact ne collecte aucune donnée de santé. Écris ces contraintes dans le brief, section « Contraintes », et en cas de doute renvoie vers la fédération du praticien (Axxon pour les kinés) ou le SPF Santé publique ; l'Ordre n'existe que pour les médecins.
6. **Entraînement IA** : demande au client s'il accepte que ses textes servent à entraîner des IA (défaut Nexxia : oui). La réponse fixe `robots.txt` (`nexxia-seo/references/geo.md`).
7. **Site existant à refondre** : exporte la liste des URL actuelles (map Firecrawl + Search Console si accès) pour la table de redirections 301.

## 2. Brief → `docs/brief.md`
Sections, chacune ≤ 6 lignes :
- **Qui** : activité, zone, cible, ce qui les différencie (dit par eux, puis observé).
- **Existant** : pages, ce qui marche, ce qui manque (mobile, vitesse, CTA, SEO local, horaires, RDV) ; liste des URL à rediriger si refonte.
- **Concurrence locale** : 2–3 lignes par concurrent, un angle à prendre.
- **Contenu récupérable** : textes et images réutilisables tels quels / à réécrire / à produire.
- **Objectif du site** en une phrase mesurable (appels, RDV, devis).
- **Contraintes** : réglementaires (santé, alimentaire, financier), techniques (outil de RDV imposé, hébergement), de contenu (pas de photos, pas de logo).
- **Requêtes et pages** : applique `nexxia-seo` (lecture SEO en une ligne : intention principale · zone · langues · concurrent le mieux placé ; collecte de 10–25 requêtes selon `references/keywords.md`, écrites dans `docs/seo/requetes.md` à partir du gabarit). Les pages prévues découlent des intentions : 4 à 8 pour un vitrine, chacune avec son intention et son objectif. Toujours : mentions légales + politique de confidentialité (RGPD) ; cookies seulement si un outil tiers en pose.
- **Identité locale** : la graphie unique du nom, l'adresse et le téléphone au format belge (NAP de référence), numéros BCE et TVA pour les mentions légales, et la liste des annuaires à aligner (`nexxia-seo/references/local-be.md`).
- **À faire par le client** : checklist mise en ligne de `local-be.md` (fiche Google, Bing, Apple, annuaires, avis, lien commune).
- **Questions pour le client** : 3 à 5, celles que le site actuel ou l'interview ne permettent pas de trancher.

## 3. Design et SEO
- Écris la lecture du brief en une ligne (type · audience · ambiance · système) selon le skill `nexxia-design`, et propose le preset de curseurs de `references/presets.md`.
- Prépare le brouillon de `PRODUCT.md` (qui, pourquoi, ton) pour `/impeccable init`. Pas de `DESIGN.md` tant que le logo et les couleurs du client ne sont pas reçus.

## 4. Fin
Affiche le brief, les 3–5 questions à envoyer au client, et la ligne suivante :
`/feature home "page d'accueil <nom-client>"` — à lancer une fois les questions tranchées.
