# Restaurer la production (Neon)

Dernière vérification : 2026-11-18 (tâche 18 du plan socle).

## Fenêtre
- Formule gratuite Neon : rétention de l'historique 6 h (`history_retention_seconds = 21600`, lu dans la console le 2026-11-18). ADR-010.
- Règle : ne compter que sur 6 h. Au-delà, la donnée est considérée perdue.
- La branche `production` n'est pas protégée (formule gratuite) : toute clé du projet peut la supprimer ou la réinitialiser.

## En cas d'incident (données abîmées ou supprimées)
1. Noter l'heure UTC du dernier état sain. Agir vite : la fenêtre est de 6 h.
2. Contrôler d'abord : console Neon → Branches → Create branch, parent `production`, données passées à l'heure choisie. Lire la copie (workspace, appartenances, données du module touché). Ne rien écrire dessus.
3. Si la copie est bonne : console Neon → branche `production` → Restore à cette heure. Neon garde l'état d'avant dans une branche de sauvegarde.
4. Vérifier l'app de production (connexion, tableau de bord), puis supprimer la copie de contrôle.
5. Les branches créées par la console expirent seules après 24 h ; les supprimer quand même à la fin.
6. Noter l'incident dans `docs/gotchas.md`.

## Ancien code servi sur le schéma neuf (Deployment Check)
- Relancer à la main un ancien run du workflow « Production » repose un succès « Migrer la production » sur un ancien commit : Vercel peut alors attribuer la production au déploiement de ce commit.
- Une build Vercel plus lente peut finir après une plus récente et prendre la production sur un code plus ancien que le schéma.
- À vérifier côté Vercel (Deployments, domaine de production) avant et après toute relance : le déploiement servi est bien celui du dernier commit de `main`. Sinon, le promouvoir à la main.
- La parade reste la règle des migrations rétrocompatibles (`.claude/rules/neon.md`) : ajouter d'abord, retirer dans un déploiement suivant. Un ancien code doit toujours tourner sur le schéma neuf.

## Test du 2026-11-18
Fait : deux copies de `production` créées dans la console, lues, puis supprimées.

| Demandé | État obtenu (date affichée par Neon) | Résultat |
|---|---|---|
| il y a 1 h | 2026-11-18 09:53 UTC (≈ 5 h avant la création) | acceptée |
| il y a 7 h | 2026-11-17 23:04 UTC (≈ 15 h 50 avant la création) | acceptée |

- Lectures sur les deux copies : 6 migrations, workspace « BeMyBrain », appartenance owner en `fr`, contextes Privé, Trustup, Nexxia. Conforme.
- Écart non expliqué : les dates obtenues ne sont pas celles demandées, et une copie au-delà de 6 h a été acceptée. Hypothèse : la date affichée est celle de la dernière écriture avant l'instant demandé, sur une base peu active. La règle reste de ne compter que sur 6 h.
- Après le test, le projet ne contient plus que `production`, `dev` et `test`.

## Ce que ce test prouve
- Les données de production d'un instant passé récent sont récupérables dans une copie lisible, avec le workspace et les appartenances intacts.

## Ce qu'il ne prouve pas
- La bascule réelle de `production` sur un état restauré (Restore en place), ni le comportement de l'app pendant et après cette bascule.
- Une restauration au-delà de 6 h : l'acceptation observée n'est pas une garantie.
