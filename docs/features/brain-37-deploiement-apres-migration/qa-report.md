# Rapport de vérification — BRAIN-37

**Statut** : à jouer · **Plan** : `plan.md` (tâches 7 et 8)

## Condition bloquante avant toute fusion
- [ ] **Le secret `VERCEL_PRODUCTION_TOKEN` existe dans GitHub → Settings → Environments → `production` → Environment secrets.** Créé par Antoine depuis 1Password, pas au niveau du dépôt. Sans lui, la fusion de cette PR migre puis échoue au déploiement ; `main` n'étant plus déployée par Vercel, la production reste sur son déploiement actuel, sans preuve de l'ordre.
- [ ] Date d'expiration du jeton communiquée par Antoine et inscrite dans ADR-010 (ligne « Conséquences »), rappel avant échéance.
- [ ] Dernier déploiement de production noté ci-dessous (identifiant, SHA) :

## Épreuve 1 — avant fusion (tâche 7)
À remplir.

## Épreuve 2 — fusion de cette PR (tâche 8)
À remplir après accord d'Antoine.

## Épreuve 3 — échec de migration provoqué (tâche 8)
À remplir.
