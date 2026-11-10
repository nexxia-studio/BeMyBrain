# GEO — être cité par les moteurs de réponse IA

Sources (octobre 2026) : étude Princeton « GEO » (Aggarwal et al., [arXiv 2311.09735](https://arxiv.org/abs/2311.09735), tableau 1), synthèses [Search Engine Land 2026](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142) et [Erlin 2026](https://www.erlin.ai/blog/generative-engine-optimization-best-practices), BrightLocal 2026 (États-Unis, Royaume-Uni, Australie). Hors Princeton, les chiffres viennent de vendeurs d'outils : ce sont des corrélations, pas des causes, et aucun n'est belge.

## Ce qu'on sait du fonctionnement
- Un prompt est décomposé en plusieurs sous-requêtes avant la sélection des sources. Une page qui couvre les variantes d'un sujet est plus souvent retenue qu'une page étroite.
- Le moteur découpe les pages en **passages** et juge chacun sur sa pertinence, sa clarté et sa densité factuelle. Une réponse cite en général quelques domaines, rarement plus de sept.
- Les sources tierces pèsent lourd : google.com (fiche d'établissement, Maps) représente environ 28 % des citations toutes réponses locales confondues chez BrightLocal 2026 ; pour ChatGPT seul, les plateformes d'avis (Yelp aux États-Unis) dominent, la fiche Google n'y est pas une source majeure. Transposé en Belgique : fiche Google, Doctoranytime / Treatwell selon le secteur, annuaires, presse locale. Le site reste la première source quand il répond clairement.
- La fraîcheur compte : les contenus publiés ou mis à jour récemment sont surreprésentés dans les citations (ordre de grandeur rapporté : la moitié datent de moins de trois mois ; indicatif, non sourcé indépendamment).
- Le HTML statique est lu ; le contenu rendu uniquement côté client l'est mal (indicatif).
- Les moteurs diffèrent beaucoup entre eux. On mesure chacun séparément.
- **Google ne demande aucun balisage particulier pour AI Overviews / AI Mode** (page officielle « AI features »). Les données structurées restent utiles aux autres moteurs et à la cohérence, pas comme levier direct.

## Tactiques classées par preuve
| Tactique | Ce qu'on a mesuré | Confiance |
| --- | --- | --- |
| Citer un expert ou une source nommée (citation textuelle) | Princeton, tableau 1 : +40,9 % de part de mots dans la réponse, +28 % d'impression subjective | Haute (moteur simulé GPT-3.5, requêtes génériques ; varie par domaine) |
| Ajouter des statistiques vérifiables | Princeton : +30,6 % / +22,8 % | Haute (même réserve) |
| Citer ses sources (liens) | Princeton : +27,5 % / +13,5 % | Haute (même réserve) |
| Réponse directe sous chaque titre-question, 1–2 phrases autonomes | Observé dans la majorité des contenus très cités (vendeurs) | Moyenne |
| Mise à jour régulière avec date visible | Corrélation forte rapportée par plusieurs vendeurs | Moyenne |
| FAQ visible + `FAQPage` JSON-LD | Corrélation rapportée (Erlin). **Google n'affiche plus les résultats enrichis FAQ depuis mai 2026** et a retiré leur rapport Search Console ; le balisage reste valide et gratuit, utile aux autres moteurs | Faible pour Google, moyenne ailleurs |
| Tableaux comparatifs, listes « les N meilleurs » nommant les concurrents | Forte part des citations sur les pages de classement | Moyenne ; rarement adapté à un vitrine local, et interdit en santé |
| `llms.txt` | Corrélation rapportée, aucun moteur ne confirme le lire | Faible : on le fait parce que c'est gratuit (impossible sur Shopify sans app) |
| Présence Wikipédia | Beaucoup plus citée que le site de marque | Inapplicable pour une PME locale |
| Laisser passer les robots de recherche IA | Condition nécessaire | Haute |

## Gabarit d'une section citable
```markdown
## Combien de temps dure une première séance d'ostéopathie ?

Une première séance dure 45 à 60 minutes : 15 minutes d'anamnèse, 30 à 40 minutes de traitement, puis les conseils pour la suite.
<!-- source: brief §prestations, Guillaume, 2026-10 -->

Le praticien commence par ... (détail en 3–5 phrases, un fait par phrase quand c'est possible : durée, fréquence, matériel, conventionnement, tarif si autorisé).

**À retenir** : [la réponse reformulée en une phrase, utile si le moteur ne prend que la fin du passage].
```
Les titres-questions et les réponses directes sont exemptés des limites de longueur de `anti-slop.md` (8 mots, 25 mots) : c'est la structure qui compte ici.

## Convention de source (ce que le reviewer vérifie)
- Fait opérationnel (horaires, durée, tarif, conventionnement, équipe) : doit correspondre à `src/data/business.ts` ou à `docs/brief.md`. Commentaire `<!-- source: brief §x -->` ou `<!-- source: client, <date> -->`.
- Statistique, pourcentage, superlatif (« le plus », « le seul ») : une URL de source publique, ou on retire.
- Rien d'autre n'est un chiffre « sourcé ». Un fait que le client affirme oralement est noté comme tel et reste à confirmer par écrit.

## Gabarit FAQ (fin de page prestation)
3 à 6 questions, formulées comme un client au téléphone : « Faut-il une prescription pour voir un kiné ? », « Est-ce remboursé par la mutuelle ? », « Vous prenez les enfants ? ». Chaque réponse : 2–4 phrases, la première autonome. JSON-LD `FAQPage` généré à partir des mêmes textes (jamais une FAQ cachée dans le schema et absente de la page). Validation : [validator.schema.org](https://validator.schema.org).

## Gabarit `llms.txt`
```
# G.Move — kinésithérapie et ostéopathie à Montzen

> Cabinet de kinésithérapie et d'ostéopathie à Montzen (Plombières, province de Liège, Belgique). Kiné générale, kiné du sport, ostéopathie. Praticiens conventionnés. Rendez-vous par téléphone et en ligne.

## Pages
- [Accueil](https://gmove.be/) : présentation, prestations, prise de rendez-vous
- [Kinésithérapie](https://gmove.be/kinesitherapie) : indications, déroulé, conventionnement
- [Ostéopathie](https://gmove.be/osteopathie) : indications, première séance, tarifs
- [Équipe](https://gmove.be/equipe) : praticiens, formations, numéros INAMI
- [Infos pratiques](https://gmove.be/contact) : adresse, horaires, accès, parking

## Zone desservie
Montzen, Plombières, Aubel, Welkenraedt, Henri-Chapelle, Kelmis.

## Langues
Français. Allemand sur demande.
```

## Robots IA : une seule liste, une question au client
Deux familles de robots, à ne pas confondre :
- **Recherche et citation** (ce qu'on veut) : `OAI-SearchBot` (ChatGPT recherche), `Claude-SearchBot`, `PerplexityBot` (Perplexity dit ne pas entraîner avec), `Bingbot` (Copilot, et une partie des réponses ChatGPT), plus les récupérateurs déclenchés par un utilisateur : `ChatGPT-User`, `Claude-User`, `Perplexity-User`. Jamais bloqués, ni dans `robots.txt` ni dans le pare-feu Vercel / Cloudflare.
- **Entraînement** (choix du client) : `GPTBot` (OpenAI), `ClaudeBot` (Anthropic), `Google-Extended` (jeton robots sans robot propre : gouverne l'entraînement Gemini et son ancrage, **pas** la recherche Google ni AI Overviews / AI Mode ; le bloquer peut coûter des citations dans l'app Gemini). Question posée dans le brief : « acceptez-vous que vos textes servent à entraîner des IA ? ». Par défaut Nexxia : autorisés (plus de visibilité, textes publics de toute façon) ; refus du client → bloquer ces trois-là seulement.
`robots.txt` est un fichier statique dans `public/` (Astro ne le génère pas) et déclare `Sitemap: https://<domaine>/sitemap-index.xml`.

## Mesurer à la main (mensuel, protocole fixe)
Fenêtre privée, déconnecté, localisation Belgique, langue française, **trois passages par prompt** (les réponses varient), date notée. Cinq prompts fixes par client :
1. « meilleur <prestation> près de <commune> »
2. « <prestation> <commune> avis »
3. « <question fréquente du secteur> » (ex. « faut-il une prescription pour un kiné en Belgique »)
4. « <nom du client> » (le moteur sait-il qui c'est ?)
5. « <concurrent principal> ou <client> ? »
Dans ChatGPT (recherche activée), Perplexity, Google AI Mode ou AI Overviews, Claude. Noter : cité oui / non (sur 3) · passage repris · concurrents cités · erreur factuelle. Tableau dans `docs/seo/suivi.md`. Une erreur sur le client (horaires, adresse) → corriger la source que le moteur a reprise (souvent la fiche Google ou un annuaire), pas seulement le site.
GA4 ou analytics sans cookie : segment « IA » sur les référents `chatgpt.com` (ajoute `utm_source=chatgpt.com`), `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com`.

## Ce qui ne marche pas
Bourrer de mots-clés, pages par commune vides, FAQ de 30 questions, dates de mise à jour factices, chiffres inventés « pour la densité », schema qui décrit du contenu absent, `aggregateRating` auto-attribué. Les moteurs recoupent ; une incohérence coûte plus que l'absence.
