# Feuille de route — BeMyBrain

Validée par Antoine le 2026-11-10. Un module = une `/feature`. L'encodage manuel vient toujours avant la synchro automatique.

## Phases
| Phase | Contenu | Projet Linear |
| --- | --- | --- |
| 0 | Socle : repo, Neon, Vercel, login, charte liquid glass + bento, bascule Privé / Pro | 0 · Socle |
| 1 | Quotidien : to-do unifiée avec tags, liste de courses partagée, bucket lists | 1 · Quotidien |
| 2 | Finance : budget 50/20/20/10, budget détaillé, banque, investissements, assurances, mobilier | 2 · Finance |
| 3 | Santé et sport, contacts et anniversaires, culture | 3 · Santé, contacts, culture |
| 4 | Pro Nexxia : clients, projets, tâches liées aux repos | 4 · Pro Nexxia |
| 5 | Maison connectée, réseaux sociaux, finances pro, assistant IA | 5 · Maison, social, assistant |

Hors périmètre pour l'instant : habitudes, routines, journal, bloc-notes, deep work.

## Notes par module (décisions déjà prises)
- **To-do** : une to-do existe déjà (Perso / Trustup / Nexxia). Elle est migrée dans BeMyBrain, pas réécrite à l'aveugle. Repo source à confirmer par Antoine.
- **Liste de courses** : modifiable par une personne externe via un lien, sans compte.
- **Budget** : règle 50/20/20/10 (essentiels, non-essentiels, investissements, épargne), écart affiché en % et en €. Chaque ligne est saisie une seule fois ; le récap se calcule.
- **Mobilier** : valeur résiduelle = prix d'achat × (1 − âge / durée de vie théorique), avec un plancher à 0 €. Jamais de valeur négative.
- **Assurances** : une fiche par contrat (maison, santé, famille, voiture…) avec garanties, prime, échéance, et comparaison avec l'offre d'un autre assureur.
- **Assistant IA** : accès en lecture à toutes les données du workspace via les fonctions de lecture des modules (ADR-004).
- **WhatsApp** (demandé le 2026-11-10) : parler à BeMyBrain depuis WhatsApp, via Hermes Agent (agent open source de Nous Research, licence MIT). Hermes tourne sur un petit serveur à part, pas sur Vercel, et accède aux données par les mêmes fonctions que l'assistant IA (ADR-004). Lecture d'abord ; écritures limitées à une liste courte (ajouter une tâche, un article de courses). Dépend de l'assistant IA.

## Intégrations : ce qui est possible
| Source | État au 2026-11-10 | Approche |
| --- | --- | --- |
| Strava | API officielle | synchro directe |
| Apple Santé | pas d'API web | l'app Health Auto Export pousse les données vers une route de BeMyBrain |
| Bevel, Yazio, Waterllama | pas d'API publique connue (non vérifié) | passent par Apple Santé |
| KBC / CBC | lecture seule via PSD2 | agrégateur (Ponto ou Enable Banking) ; consentement à renouveler tous les 90 jours ; cartes de crédit KBC non couvertes |
| Trade Republic | pas d'API officielle connue | import CSV + encodage, cours via une API de marché |
| Finary | pas d'API pour l'app | inspiration uniquement |
| Accountable | pas d'API publique connue (non vérifié) | export ou encodage |
| Instagram, Facebook, TikTok | API avec validation d'app | module tardif |
| Home Assistant | API locale | quand l'installation existe, avec accès distant sécurisé |
| WhatsApp (via Hermes Agent) | deux voies : pont non officiel par QR code (rapide, risque de blocage du numéro) ou API officielle WhatsApp Business (compte Meta à valider) | numéro dédié + pont QR pour l'usage perso ; API officielle avant tout usage multi-comptes |

Chaque ligne « non vérifié » est à revérifier au moment de la spec du module concerné.
