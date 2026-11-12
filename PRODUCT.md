# PRODUCT — BeMyBrain

Contexte produit pour toute décision d'interface. La charte visuelle est dans `DESIGN.md`.

## À quoi ça sert
BeMyBrain est un second cerveau : un seul tableau de bord pour la vie privée (tâches, listes, finances, santé, maison, contacts, culture) et la vie pro (Trustup, Nexxia, réseaux sociaux). On l'ouvre pour savoir quoi faire maintenant, et on y note une chose en quelques secondes pour ne plus y penser.

## Pour qui
- Aujourd'hui : Antoine, un seul compte. Fondateur, deux casquettes pro (Trustup la journée, Nexxia en complément), une vie de famille.
- Ensuite : des abonnés qui vivent la même double vie (indépendants, salariés avec une activité à côté). Rien dans l'interface ne suppose qu'il n'y a qu'Antoine : pas de prénom ni de contexte en dur, tout vient des données du workspace.

## Principes produit
1. **Second cerveau, pas un outil de plus.** L'écran d'accueil répond à « qu'est-ce qui compte aujourd'hui ? » en un coup d'œil. Une seule tuile pleine, « Aujourd'hui », le dit ; le reste attend en verre.
2. **Privé / Pro, jamais mélangés.** La bascule en haut de l'écran change tout l'écran : tuiles, navigation, tâches. Côté Pro, on filtre Trustup, Nexxia ou les deux. Le choix est conservé.
3. **Mobile d'abord.** Usage principal au téléphone, d'une main. Navigation au pouce, ajout rapide au centre de la barre du bas, zones tactiles d'au moins 44 px. L'app s'installe sur l'écran d'accueil (PWA). L'ordinateur reçoit la même chose, avec plus de place.
4. **Français et anglais.** Toute l'interface existe dans les deux langues, choisies par l'utilisateur. Dates, nombres et montants suivent la langue. Le contenu saisi par l'utilisateur n'est jamais traduit.
5. **Calme et rapide.** Un geste répété répond tout de suite. Les moments soignés (entrée du tableau de bord, révélation de la grille) jouent une fois, pas à chaque clic.
6. **Prêt pour l'assistant IA, plus tard.** Chaque action de l'app (ajouter, filtrer, changer de langue) existe aussi en commande nommée, lançable depuis la palette (⌘K) aujourd'hui, par l'assistant demain. Une seule base de données, rien de métier stocké ailleurs.

## Ton des textes
- **Français** : direct, chaleureux sans familiarité, tutoiement exclu (vouvoiement implicite, tournures impersonnelles de préférence : « Ajouter une tâche », pas « Ajoutez votre tâche »). Phrases courtes. Verbes d'action sur les boutons. Pas de jargon, pas d'anglicismes quand le mot français existe (« tâche », pas « task » ; « To-do » reste comme nom de module).
- **Anglais** : même ton, plus bref. Sentence case (« Add a task »), pas de majuscule à chaque mot.
- Chiffres concrets plutôt qu'adjectifs : « 3 tâches aujourd'hui », pas « Une journée chargée ».
- Erreurs : dire ce qui s'est passé et quoi faire, sans détail technique ni faute rejetée sur l'utilisateur.
- Écrans vides : une phrase qui dit à quoi sert l'endroit, et l'action pour le remplir.

## Ce que l'interface ne fait jamais
- Mélanger le Privé et le Pro sur un même écran sans que l'utilisateur l'ait demandé.
- Afficher un texte en dur, ou une chaîne dans une seule langue.
- Inventer une donnée pour remplir une tuile (pas de faux chiffres, pas de faux graphiques) : une tuile sans données montre son état vide.
- Rejouer une animation sur un geste répété, ou animer quoi que ce soit quand le système demande moins de mouvement.
- Envoyer un détail technique ou une donnée personnelle dans un message d'erreur.
- Demander une confirmation pour une action réversible ; en demander toujours une pour une action destructive.
- Pousser l'inscription, l'abonnement ou une notification sans demande.
- Utiliser une couleur, une police ou un rayon hors de `DESIGN.md`.
