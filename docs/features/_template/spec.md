# Spec — [Nom de la feature]

**Créée le** : [date] · **Statut** : brouillon | validée | livrée · **Plan** : `plan.md`

## Objectif
[Une phrase : quel problème pour quel utilisateur. Si tu ne peux pas la formuler, la feature n'est pas prête.]

## Hors périmètre
- [Ce qu'on ne fait PAS dans cette feature, explicitement — c'est ce qui empêche la dérive.]

## Critères d'acceptation
<!-- Chacun doit être testable par un test automatisé ou un scénario QA. -->
- [ ] [Quand <condition>, alors <résultat observable>.]
- [ ] …

## Scénarios utilisateur (joués par /qa)
<!-- Un scénario = un parcours complet, du point de départ au résultat visible. -->
1. **[Nom du scénario]** — [rôle] part de [écran], fait [actions], obtient [résultat]. Variante mobile : oui/non.
2. …

## Données et sécurité
- Tables touchées : [liste] — nouvelles colonnes : [liste]
- RLS : [quelle policy, quel filtre tenant]
- Argent / paiement concerné : oui/non → `security-auditor` obligatoire

## UI
- Écrans concernés : [liste] — maquette : [lien Claude Design / Figma ou « aucune »]
- Contraintes DESIGN.md : [tokens à respecter, composants à réutiliser]

## Questions ouvertes
- [ ] [Question] — à trancher par Antoine avant la tâche [n]
