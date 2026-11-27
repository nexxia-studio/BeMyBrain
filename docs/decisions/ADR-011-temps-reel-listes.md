# ADR-011 — Synchro instantanée de la liste de courses : Ably en « signal », la donnée passe par nos chemins sécurisés

**Date** : 2026-11-28 · **Statut** : proposé (à valider par Antoine avec la spec `listes`) · **Contexte** : BRAIN-9, décision d'Antoine du 2026-11-27 (synchro instantanée dans les deux sens, invité ↔ app)

## Contexte
La liste de courses partagée par lien doit se mettre à jour des deux côtés sans recharger. C'est la première brique temps réel du projet.
Contraintes :
- Next.js sur Vercel (fonctions à durée limitée, pas de processus long) et Neon (ADR-001, ADR-005).
- Double verrou RLS (ADR-002) : toutes les tables métier ont la RLS. L'invité n'a ni compte ni session.
- Un invité ne peut recevoir que ce qui concerne sa liste, et perd l'accès quand le lien est révoqué.
- Formules gratuites (Neon, Vercel Hobby), pas de dépendance sans justification.

## Options comparées

| | A. Neon Realtime | B. Service managé (Ably) | C. SSE maison + Postgres `LISTEN/NOTIFY` |
| --- | --- | --- | --- |
| Coût | gratuit pendant la bêta, puis facturation à venir (non annoncée) | gratuit dans les limites du palier (à revérifier au plan) | gratuit, mais une fonction Vercel et une connexion base tenues ouvertes par abonné |
| Sécurité du canal invité | requête scellée (60 s, renouvelée) : bon modèle, **mais refuse toute table avec RLS** (`upstream_rejected`) | jeton émis par notre serveur, droit « s'abonner » sur **un seul canal**, durée courte, vérifié par le fournisseur | tout est à écrire et à tenir : authentification de chaque flux, nettoyage à la révocation |
| Simplicité | pas de fournisseur de plus, mais : bêta (protocole « pas encore stable »), Postgres 18 requis (OK ici), activation = **`wal_level = logical` permanent et redémarrage de tous les calculs du projet, toutes branches** (production comprise) | un SDK, un compte, deux variables d'environnement, CSP à ouvrir | `LISTEN` ne passe pas par le pooler de Neon et empêche la mise en veille de la base ; durée maximale des fonctions Vercel ⇒ reconnexions permanentes |
| Verdict | écartée pour l'instant | **retenue** | écartée |

Pourquoi A est écartée malgré son charme (pas de fournisseur, gratuite, même région `aws-eu-central-1`, Postgres 18 déjà en place) :
1. Elle ne lit pas les tables à RLS. Pour la contourner il faudrait une table sans RLS réservée au temps réel, donc une exception à ADR-002 (« RLS dans la même migration que la table »).
2. L'activation redémarre la production et change `wal_level` de façon irréversible, pour une fonctionnalité en bêta sans garantie de protocole ni de prix.
3. Le gain est faible : nous n'avons besoin que d'un signal (« la liste a changé »), pas d'un moteur de synchronisation de requêtes.
À rouvrir à la disponibilité générale si elle gère la RLS : le signal étant un simple message, le changement de transport tient dans un seul module.

Pourquoi B plutôt que C : C coûte plus de code sensible (cycle de vie des connexions sur Vercel) que B ne coûte de dépendance, et reste moins sûre.

Ably plutôt que Pusher : le **jeton à capacités** (`subscribe` seul, sur un seul canal, durée courte) fait imposer par le fournisseur la règle « l'invité ne s'abonne qu'au canal de sa liste ». Chez Pusher, c'est notre point d'authentification qui l'impose seul. Limites du palier gratuit des deux : à revérifier sur leurs pages de tarifs avant le plan (chiffres non vérifiés ici).

## Décision
1. **Le temps réel ne transporte aucune donnée métier.** Message = `{ rev }` (numéro de version de la liste). À la réception, le client relit la liste par le chemin normal (Server Action : session pour Antoine, fonctions invité pour l'invité). Une fuite ou une erreur du canal ne révèle donc rien d'autre que « quelque chose a changé ».
2. **Publication par le serveur seulement**, après chaque écriture de liste (app comme invité). Échec de publication : sans effet sur l'écriture ; le rattrapage compense.
3. **Canal** `shopping:<channel_id>`, où `channel_id` est un uuid aléatoire propre à la liste (colonne dédiée, différent de l'id de la liste, jamais le jeton du lien). Régénérer ou révoquer le lien en génère un nouveau.
4. **Jetons Ably** émis par une Server Action : propriétaire (session valide) ou invité (jeton de lien valide, non révoqué). Capacité : `subscribe` sur ce canal uniquement. Durée 10 minutes, renouvelée par le client tant que l'accès existe : un invité révoqué perd le signal au plus tard à l'expiration, sans jamais avoir eu de donnée.
5. **Rattrapage obligatoire** : relecture complète à l'ouverture, à la reconnexion du canal, au retour au premier plan (`visibilitychange`) et au retour du réseau (`online`). Aucun état n'est reconstruit à partir des seuls messages.
6. **Chargement différé** : le SDK n'entre pas dans le bundle initial (même contrainte que Sentry, `docs/runbooks/sentry.md`, verrou `tests/build/initial-bundle.test.ts`).
7. **Secrets** : clé Ably en variable d'environnement serveur (Vercel production et previews), jamais exposée au navigateur. Avec l'infra existante (ADR-010), la pose pour les previews passe par `scripts/ci/vercel-preview-env.mjs`.
8. **CSP** : `connect-src` reçoit les origines Ably (HTTPS et WebSocket), rien d'autre (`src/lib/security-headers.ts`).

## Alternatives écartées
- Interrogation périodique (polling) : contraire à la décision d'Antoine (instantané), et coûteuse en requêtes.
- Neon Realtime et SSE maison : voir tableau.
- Messages portant les articles : la donnée passerait par un tiers et contournerait nos deux verrous.

## Conséquences
- Un compte et une clé chez Ably : action d'Antoine avant la PR « partage et temps réel » (le plan l'indique en tête de ce bloc).
- Nouvelle dépendance : le SDK Ably (justification au plan, avec taille et chargement différé).
- ADR-002, dernière puce des conséquences, corrigée : le lien de partage n'ouvre **pas** une policy dédiée mais passe par un rôle sans accès aux tables et des fonctions `SECURITY DEFINER` (spec `listes`, § Partage sans compte).
- Risque résiduel accepté : un invité révoqué reçoit encore des signaux sans contenu pendant 10 minutes au plus.
