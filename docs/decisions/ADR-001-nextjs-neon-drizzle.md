# ADR-001 — Construire sur Next.js, Neon et Drizzle

**Date** : 2026-11-10 · **Statut** : accepté

## Contexte
Le kit Nexxia part par défaut sur Vite + React + Supabase. La limite de 2 projets gratuits Supabase est atteinte.
BeMyBrain a besoin de routes serveur : webhooks entrants, tâches planifiées, secrets bancaires.

## Décision
L'app est en Next.js (App Router) sur Vercel. La base est Neon (Postgres), accédée avec Drizzle. Les migrations sont versionnées dans `drizzle/`.

## Alternatives écartées
- Vite + React + Supabase payant — garde le kit tel quel, mais coûte un abonnement pour un projet personnel.
- Vite + React + Neon — pas de côté serveur intégré, il faudrait ajouter une API à part.

## Conséquences
- Les règles Supabase du kit sont remplacées par `.claude/rules/neon.md`.
- Pas d'auth ni de stockage de fichiers fournis d'office : voir ADR-003 pour l'auth ; le stockage se décide au premier module qui en a besoin.
- Les agents `security-auditor` et `explorer`, et le skill `feature`, citaient Supabase : adaptés dans BRAIN-2, le 2026-11-11.
