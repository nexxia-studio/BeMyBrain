---
name: feature
description: Démarre une feature proprement — analyse de l'existant par l'agent explorer, puis brainstorming jusqu'à une spec validée, puis plan en tâches. Crée docs/features/<nom>/. À lancer au début d'une session vide.
argument-hint: "<nom-de-la-feature> [description courte]"
disable-model-invocation: true
---

Feature à démarrer : **$ARGUMENTS**

Déroule les étapes dans l'ordre. Ne saute pas l'analyse, même si la feature semble simple.

## 1. Analyse de l'existant
Dispatche l'agent `explorer` avec : « Cartographie tout ce qui touche à : $ARGUMENTS. Inclus tables, policies RLS, composants, routes, et les pièges de docs/gotchas.md. »
Attends sa note. Résume-la en 5 lignes à Antoine et signale toute incohérence avec ce qu'il demande AVANT de continuer.

## 2. Spec
Utilise le skill `brainstorming` (superpowers). Pose les questions une par une. Objectif : remplir `docs/features/<nom>/spec.md` à partir de `docs/features/_template/spec.md`.
La spec n'est pas finie tant que ces sections ne sont pas remplies : Objectif, Hors périmètre, Critères d'acceptation (testables), Scénarios utilisateur (pour `/qa`), Données et RLS, Questions ouvertes.
Montre la spec par blocs et attends validation explicite d'Antoine.

## 3. Plan
Utilise le skill `writing-plans` (superpowers). Écris `docs/features/<nom>/plan.md` : tâches de 1–2 h max, chacune avec fichiers touchés, test à écrire, critère de fin.
Si une tâche touche `supabase/`, une migration ou un paiement, marque-la `[security]` : la session principale devra dispatcher `security-auditor` après le reviewer sur cette tâche (rien ne le fait automatiquement).

## 4. Handoff
Mets à jour `docs/handoff.md` : feature en cours, tâche 1 à attaquer, commande pour lancer l'implémentation.
Termine par la ligne exacte à copier pour la suite :
`Exécute docs/features/<nom>/plan.md avec subagent-driven-development, en dispatchant subagent_type implementer pour chaque tâche et subagent_type reviewer pour chaque review.`
