# Architecture — [NOM DU PROJET]

<!-- Court et à jour vaut mieux que complet et faux. Mis à jour par scribe quand un module, une table ou un flux change. -->

## Vue d'ensemble
[3–5 lignes : frontend, backend, auth, paiement, hébergement.]

## Modules
| Module | Dossier | Rôle | Dépend de |
| --- | --- | --- | --- |
| [auth] | `src/features/auth` | [connexion, onboarding] | Supabase Auth |

## Tables principales
| Table | Tenant | Rôle | Notes |
| --- | --- | --- | --- |
| [gyms] | — | [un tenant] | |
| [members] | `gym_id` | | un abonnement actif max (index unique partiel) |

## Flux critiques
1. [Réservation] : [écran] → [mutation] → [Edge Function / RPC] → [tables] → [notification]
2. [Paiement] : [checkout] → [webhook signé] → [mise à jour statut]

## Intégrations externes
| Service | Usage | Clé / config |
| --- | --- | --- |
| [Stripe \| Mollie] | [paiement] | `.env` (jamais ici) |

## Environnements
- Local : `supabase start` + `pnpm dev`
- Staging : [URL Vercel] — projet Supabase [nom]
- Production : [URL] — projet Supabase [nom]
