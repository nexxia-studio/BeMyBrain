# Documentation — BeMyBrain

Index lu par Claude au démarrage (via `@docs/README.md` dans CLAUDE.md). Une ligne par fichier. Mis à jour par l'agent `scribe`.

| Fichier | Contenu | Quand le lire |
| --- | --- | --- |
| `handoff.md` | État courant, dernière action, prochaine étape | Début de chaque session |
| `gotchas.md` | Pièges connus : symptôme → cause → parade | Avant de coder, avant de déboguer |
| `architecture.md` | Modules, tables, flux principaux, intégrations | Avant une spec, avant un changement de schéma |
| `roadmap.md` | Phases, décisions par module, état des intégrations | Avant de spécifier un nouveau module |
| `decisions/` | ADR : une décision structurante par fichier | Avant de proposer un choix déjà tranché |
| `features/<nom>/` | `spec.md`, `plan.md`, `qa-report.md` d'une feature | Pendant la feature |
| `features/_template/` | Modèles de spec et de plan | Au `/feature` |
| `design/references/` | Visuels de référence (liquid glass, bento) | Avant DESIGN.md et toute UI |
| `instructions-projet-claude-ai.md` | Texte à coller dans le Projet claude.ai, pas lu par Claude Code | Une fois, à la mise en place |

## Conventions
- Français, phrases courtes, un fait par ligne. Daté quand ça compte.
- Rien de secret ici : pas de clé, pas d'URL d'admin, pas de donnée personnelle de clients finaux (le brief décrit l'entreprise cliente, jamais ses clients).
- Un fichier qui n'est plus vrai est corrigé ou supprimé, pas laissé « pour l'historique » (git s'en charge).
