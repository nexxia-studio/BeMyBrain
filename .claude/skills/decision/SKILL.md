---
name: decision
description: Enregistre une décision d'architecture ou de règle métier en ADR court dans docs/decisions/. À utiliser dès qu'un choix structurant est tranché (lib, schéma, règle no-show, fournisseur de paiement) pour qu'il ne soit pas rediscuté dans trois sessions.
argument-hint: "<titre court de la décision>"
---

Décision à enregistrer : **$ARGUMENTS** (si vide : déduis le titre de la décision qui vient d'être prise dans la conversation, et confirme-le en une ligne avant d'écrire).

1. Trouve le prochain numéro : `ls docs/decisions/` → dernier ADR + 1.
2. Si le contexte de la conversation ne suffit pas, pose au maximum 3 questions : quelle alternative a été écartée, pourquoi, quelle conséquence on accepte.
3. Écris `docs/decisions/ADR-NNN-<slug>.md` sur le modèle `docs/decisions/ADR-000-template.md`, 20 lignes max, daté du jour.
4. Ajoute l'entrée dans `docs/README.md`.
5. Si la décision contredit une ligne de `CLAUDE.md` ou d'un fichier `.claude/rules/`, signale-le et propose la modification — ne la fais pas sans accord.
