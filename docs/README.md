# Documentation — [NOM DU PROJET]

Index lu par Claude au démarrage (via `@docs/README.md` dans CLAUDE.md). Une ligne par fichier. Mis à jour par l'agent `scribe`.

| Fichier | Contenu | Quand le lire |
| --- | --- | --- |
| `handoff.md` | État courant, dernière action, prochaine étape | Début de chaque session |
| `gotchas.md` | Pièges connus : symptôme → cause → parade | Avant de coder, avant de déboguer |
| `architecture.md` | Modules, tables, flux principaux, intégrations | Avant une spec, avant un changement de schéma |
| `decisions/` | ADR : une décision structurante par fichier | Avant de proposer un choix déjà tranché |
| `features/<nom>/` | `spec.md`, `plan.md`, `qa-report.md` d'une feature | Pendant la feature |
| `features/_template/` | Modèles de spec et de plan | Au `/feature` |
| `brief.md` | Brief client produit par `/brief-client` (sites vitrine) | Avant la première `/feature` d'un site client |
| `seo/requetes.md` | Requêtes par intention → page cible, concurrent, statut | Avant d'écrire une page, à chaque `/seo-audit` |
| `seo/suivi.md` | 5 prompts IA de référence et relevés mensuels, scores Lighthouse | Une fois par mois |
| `seo/audit-AAAA-MM.md` | Rapports `/seo-audit` | Au trimestre |
| `instructions-projet-claude-ai.md` | Texte à coller dans le Projet claude.ai, pas lu par Claude Code | Une fois, à la mise en place |

## Conventions
- Français, phrases courtes, un fait par ligne. Daté quand ça compte.
- Rien de secret ici : pas de clé, pas d'URL d'admin, pas de donnée personnelle de clients finaux (le brief décrit l'entreprise cliente, jamais ses clients).
- Un fichier qui n'est plus vrai est corrigé ou supprimé, pas laissé « pour l'historique » (git s'en charge).
