---
name: handoff
description: Clôture proprement une session — l'agent scribe met à jour docs/handoff.md, docs/gotchas.md et les ADR, puis affiche la commande exacte pour reprendre dans une session vide. À lancer avant /clear ou avant de fermer le terminal.
argument-hint: "[à quoi servira la prochaine session — optionnel]"
disable-model-invocation: true
---

Clôture de session. Focus de la prochaine session : **$ARGUMENTS** (si vide : continuer le plan en cours).

1. Fais le point en 5 lignes max : fait, en cours, bloqué. Si un focus est donné, oriente tout le handoff dessus.
2. Fichiers modifiés hors `docs/` non commités → propose d'abord un commit (message en français, une ligne, préfixé par le nom de la feature). Pas de commit sans accord ; dans ce cas le handoff les listera comme « en attente ».
3. Dispatche l'agent `scribe` avec ce point et ces consignes :
   - Mets à jour `docs/handoff.md` (modèle en place), `docs/gotchas.md`, les ADR si une décision a été prise, et coche les tâches finies dans le plan. Vérifie avec `git log`.
   - **Ne recopie pas** ce qui est déjà dans la spec, le plan, un ADR, un commit ou un diff : référence-les par chemin ou hash.
   - Remplis la section « Skills et agents pour la suite » : lesquels la prochaine session devra appeler, et dans quel ordre.
   - Retire tout secret, clé, e-mail ou donnée personnelle avant d'écrire.
4. Affiche `docs/handoff.md` tel qu'écrit par le scribe, puis commite `docs/` seul (`docs: handoff <date>`) si Antoine est d'accord.
5. Termine par la ligne exacte à copier dans la prochaine session, par exemple :
`Lis docs/handoff.md et continue : tâche 3 de docs/features/<nom>/plan.md.`
