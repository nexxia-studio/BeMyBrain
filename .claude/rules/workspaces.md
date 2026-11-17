---
paths:
  - "src/**"
  - "scripts/**"
  - "drizzle/**"
---
# Règles workspaces

- Un utilisateur aura plusieurs workspaces (espace partagé « Famille », BRAIN-32 ; validé par Antoine le 2026-11-13). N'ajouter aucune nouvelle supposition « un utilisateur = un seul workspace » : pas de nouveau `limit(1)` sur les appartenances d'un utilisateur, pas de workspace déduit de l'utilisateur seul. Le `workspaceId` vient de la session et se passe explicitement.
- Les endroits qui font déjà cette supposition sont listés dans `docs/gotchas.md` (BRAIN-32). En toucher un : ne pas l'étendre, le signaler.
