# Plan — [Nom de la feature]

**Spec** : `spec.md` · **Branche** : `feat/[nom]` · **Créé le** : [date]

<!-- Une tâche = 1–2 h max, un seul implementer, un seul commit. Si une tâche dépasse, découpe-la. -->
<!-- [security] = security-auditor passe après le reviewer. -->

## Tâches
- [ ] **1. [Verbe + objet]**
  - Fichiers : `[chemin]`, `[chemin]`
  - Test à écrire d'abord : `[fichier.test.ts]` — « [comportement] »
  - Fini quand : [critère observable]
- [ ] **2. [Verbe + objet]** [security]
  - Fichiers : `src/db/schema/[module].ts`, `drizzle/[…].sql` (générée par `pnpm db:generate`)
  - Test à écrire d'abord : `tests/db/isolation-[module].test.ts` (branche de test, connexion `app_backend`, claims posés à la main) — « l'utilisateur du workspace B ne lit ni n'écrit rien chez A »
  - Fini quand : migration appliquée sur la branche de test, RLS + une policy par verbe, test vert
- [ ] **3. …**

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
