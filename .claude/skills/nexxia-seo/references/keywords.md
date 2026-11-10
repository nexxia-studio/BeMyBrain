# Recherche de requêtes sans outil payant

<!-- « Requête » partout : c'est ce que l'utilisateur tape. « Mot-clé » n'est pas utilisé dans le kit. -->

Objectif : en 30 minutes, une liste de 10 à 25 requêtes réelles, classées par intention, qui devient la liste des pages et des titres. On ne cherche pas le volume exact (inaccessible gratuitement), on cherche ce que les gens tapent et ce que Google affiche en face.

## 1. Collecte (Google à la main + Firecrawl pour les concurrents)
Firecrawl search renvoie des résultats organiques, pas le pack local ni les « Autres questions ». Pour ceux-là : Google dans le navigateur Chrome (fenêtre privée, localisation BE), ou Search Console si le site existe.
Pour chaque prestation × commune principale :
- Requête de base : « kiné Montzen » → noter les 3 premiers résultats organiques (concurrents), le pack local (qui, combien d'avis), les « Autres questions posées », les « Recherches associées ».
- Variante problème : « ostéopathe mal de dos Plombières », « kiné après opération genou ».
- Variante pratique : « kiné conventionné près de Montzen », « ostéopathe samedi Aubel », « kiné domicile Welkenraedt ».
- Variante informationnelle : « kiné ou ostéo pour une sciatique », « combien de séances de kiné après entorse ».
- Si le site existe : Search Console → Performance → requêtes des 3 derniers mois, triées par impressions ; celles en position 5–20 sont les gains rapides.

## 2. Classement par intention
| Intention | Exemple | Page qui la sert | Signal de réussite |
| --- | --- | --- | --- |
| Transactionnelle locale | « kiné Montzen », « ostéopathe Plombières » | Accueil, prestation | Pack local + position organique |
| Pratique | « kiné conventionné samedi », « ostéo à domicile » | Prestation (section) ou infos pratiques | Réponse directe dans le passage |
| Problème | « mal de dos ostéopathe ou kiné » | Prestation (FAQ) ou article | Citation IA, « Autres questions » |
| Informationnelle | « combien de séances de kiné » | FAQ, article court | Citation IA |
| Marque | « G.Move Montzen » | Accueil | Fiche Google + site en 1 |

Une page par intention transactionnelle. Les intentions pratiques et problèmes deviennent des sections ou des FAQ de la page prestation concernée, pas des pages séparées (sauf si la question est assez large pour un article de 400–800 mots).

## 3. De la requête au titre
- `<title>` : `Prestation à Commune | Nom` → « Kinésithérapeute à Montzen | G.Move » (≤ 60 caractères).
- `<h1>` : la même intention, formulée pour un humain : « Kinésithérapie à Montzen, conventionnée, du lundi au samedi ».
- `meta description` : verbe + bénéfice + preuve + zone, ≤ 155 caractères : « Prenez rendez-vous avec un kiné conventionné à Montzen. Kiné générale et sportive, séances de 30 min, parking sur place. »
- Titres `h2` : les questions pratiques et problèmes collectées à l'étape 1, telles quelles.

## 4. Ce qu'on écrit dans `docs/seo/requetes.md`
```markdown
# Requêtes — <client> — <date>

| Requête | Intention | Page cible | Concurrent en tête | Statut |
| --- | --- | --- | --- | --- |
| kiné Montzen | transac. locale | /kinesitherapie | cabinet X (Aubel) | à créer |
| ostéopathe conventionné Plombières | pratique | /osteopathie § conventionnement | — | à créer |
```
Relu à chaque `/seo-audit` ; les colonnes « position » et « cité par IA » s'ajoutent après mise en ligne.

## 5. Secteurs
- Santé : les requêtes « avis », « meilleur », « pas cher » existent mais on n'y répond pas par du contenu promotionnel ; on répond par du factuel (conventionnement, déroulé, accès).
- Beauté : fort poids des requêtes par prestation précise (« épilation laser Verviers », « soin visage hydratant ») et des requêtes saisonnières ; le blog a du sens.
- Construction : requêtes par métier + commune et par problème (« toiture qui fuit Verviers ») ; photos de chantier réelles, nommées et légendées avec la commune.
- Shopify : requêtes produit et marque, « où acheter <marque> en Belgique », comparatifs ; collections = pages d'intention.
