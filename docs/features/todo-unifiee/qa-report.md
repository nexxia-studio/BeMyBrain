## QA — todo-unifiee — 2026-11-19

Cadre : branche `feat/todo-unifiee` (`2e5c014`), `pnpm dev` en local (port 3000), base Neon `dev` (hôte du `.env` comparé à `NEON_PRODUCTION_HOST` avant toute action : différent), compte e2e « +e2e ». Chromium par Playwright (bibliothèque du projet, scripts hors dépôt) : ordinateur 1440×900, mobile avec l'émulation iPhone 15 (390 px) dans Chromium (WebKit refuse les cookies `__Secure-` sur http://localhost). Fuseau du navigateur : Europe/Brussels.
Pour chaque scénario : snapshot d'accessibilité après chaque action structurante, console (erreurs et avertissements), requêtes ≥ 400 et requêtes en échec relevées. Origine, côté et espace vérifiés en base (lecture seule).
Captures : `/private/tmp/claude-502/-Users-Nexxia--bemybrain/26e04c20-1ae7-42b3-891e-d8bb5c7ce968/scratchpad/qa/` (noté `qa/` plus bas). Rien n'est écrit dans le dépôt hors ce rapport.
Limite connue, non comptée : Playwright ne simule pas le clavier virtuel d'iOS (validé par Antoine sur iPhone le 2026-11-19).

| # | Scénario | Résultat | Preuve |
|---|---|---|---|
| 1 | Ajout rapide sur mobile (et ordinateur) | PASS | `qa/s1-m-01…07`, `qa/s1-d-01…07` |
| 2 | Ajout par la palette (ordinateur et mobile) | PASS | `qa/s2-d-01…03`, `qa/s2-d-filtre-01…03`, `qa/s2-m-01…03`, `qa/s2-m-filtre-01…03` |
| 3 | Titre seul | PASS | `qa/s3-d-01-ajoutee.png`, `qa/s3-d-02-detail.png`, `qa/s3-d-03-liste.png` |
| 4 | Aujourd'hui | PASS | `qa/s4-d-01-tuile-pro.png`, `qa/s4-d-03-liste-pro.png`, `qa/s4-d-04-apres-coche.png`, `qa/s4-d-05-tuile-apres.png` |
| 5 | Sous-tâches et corbeille (ordinateur et mobile) | PASS | `qa/s5-d-01…08`, `qa/s5-m-01…08` |
| 6 | Filtres (ordinateur et mobile) | PASS | `qa/s6-d-01…05`, `qa/s6-m-01…05` |
| 7 | Langue (anglais) | PASS | `qa/s7-d-01…09` |

Console : aucune erreur ni aucun avertissement sur l'ensemble des parcours. Réseau : aucune réponse 4xx/5xx, aucune requête en échec (hors 404 attendus du nettoyage sur des tâches déjà à la corbeille).

### Détail par scénario

**1. Ajout rapide sur mobile** — 390 px, tableau de bord, côté Pro, filtre « Les deux ».
- « + » central → tiroir « Ajouter une tâche », focus dans « Tâche », « Ajouter » désactivé tant que le titre est vide (`s1-m-01-ouvert.png`).
- Saisie « Relancer le devis QA2ls9 », Espace → menu « Aucun / Trustup / Nexxia » (espaces Pro seulement) → Trustup ; Tags → « client » + Entrée ; Échap ferme le menu seul, pas le tiroir ; Date → Demain. Pastilles « Trustup », « Demain », « client » (`s1-m-05-avant-valider.png`).
- Ajouter → « Tâche ajoutée » + « Ouvrir » ; titre vidé, focus rendu au titre, date et tags vidés, espace Trustup gardé (`s1-m-06-apres-valider.png`).
- To-do, filtre Trustup : la tâche est dans « Demain », tag « client » (`s1-m-07-liste-pro-trustup.png`). En base : `origin = app`, `pro`, Trustup, échéance 2026-11-20.
- Ordinateur (bouton rond de l'en-tête → dialogue centré) : même parcours, même résultat (`s1-d-*`).
- Attendu = obtenu.

**2. Ajout par la palette**
- Ordinateur, côté Pro, « Les deux » : ⌘K → focus dans la recherche, « Payer la crèche QA40p3 » → seul élément « Ajouter la tâche « Payer la crèche QA40p3 » » (groupe Tâches) → clic. La palette se ferme, la tuile « Tâches pro » montre la tâche aussitôt (`s2-d-02-apres-choix.png`). En base : `palette`, `pro`, espace nul.
- Ordinateur, côté Pro, filtre Nexxia : tâche créée en `pro` / Nexxia, `palette`.
- Mobile, côté Privé, palette ouverte depuis la loupe de l'en-tête (`s2-m-01-palette-saisie.png`) : `palette`, `private`, espace nul. Mobile, côté Pro, filtre Trustup : `palette`, `pro`, Trustup.
- La tâche apparaît dans la liste du côté actif dans les quatre cas. Attendu = obtenu.

**3. Titre seul** — ordinateur, côté Privé.
- « Acheter des ampoules QA9u1g » puis deux Entrée rapides (double soumission) : une seule tâche créée (une seule ligne dans la liste).
- Détail : Statut « À faire », Priorité « Aucune », Côté « Privé », Espace « Aucun », Échéance « Sans date », Tags « Aucun » (`s3-d-02-detail.png`) ; ligne dans « Sans échéance » (`s3-d-03-liste.png`). Attendu = obtenu.

**4. Aujourd'hui** — ordinateur. Tâches créées par l'ajout rapide : Privé due le 18 nov. (hier), Pro due aujourd'hui 14:00, Pro due demain.
- Tableau de bord, côté Pro : tuile « 1 En retard · 1 Aujourd'hui », liste « Hier privé » (légende « Privé · 18 nov. ») puis « Appel 14h pro » (« Pro · 14:00 ») ; la tâche de demain n'y est pas (`s4-d-01-tuile-pro.png`). Même contenu côté Privé (`s4-d-02-tuile-prive.png`).
- Liste Pro : coche « Appel 14h pro » → case désactivée pendant l'appel (constaté), ligne retirée (`s4-d-04-apres-coche.png`).
- Tableau de bord : « 1 En retard · 0 Aujourd'hui », seule « Hier privé » reste (`s4-d-05-tuile-apres.png`). Attendu = obtenu.

**5. Sous-tâches et corbeille** — ordinateur puis mobile.
- Parente créée par l'ajout rapide, « Ouvrir » → détail ; deux sous-tâches ajoutées par le champ « Ajouter une sous-tâche » + Entrée (champ vidé après chaque ajout, compteur 0/2 — `s5-m-01-deux-sous-taches.png`).
- Détail de la sous-tâche A : lien « Sous-tâche de … », « Côté et espace : Comme la tâche parente », pas de champ de sous-tâche (`s5-d-02-detail-sous-tache.png`). « Mettre à la corbeille » → « Tâche mise à la corbeille ».
- Parente : il reste B ; « Mettre à la corbeille ». La parente disparaît de la liste.
- Corbeille : parente avec « + 1 sous-tâche », A isolée avec « ↳ parente » ; B n'apparaît pas seule (`s5-m-05-corbeille.png`).
- « Restaurer » sur la parente : elle revient dans la liste avec « 0/1 », son détail montre B seule ; A reste à la corbeille (`s5-d-07…08`, `s5-m-07…08`). Attendu = obtenu.

**6. Filtres** — ordinateur puis mobile, liste `/tasks`.
- Privé : uniquement les tâches Privé. Pro « Les deux » : uniquement les tâches Pro (pastilles Trustup / Nexxia). Nexxia : la seule tâche Nexxia. Trustup : les trois tâches Trustup.
- « Terminées » allumé : section « Terminées » avec « Appel 14h pro » cochée ; éteint : section absente (`s6-*-05-terminees.png`). Attendu = obtenu.

**7. Langue** — ordinateur. Passage en anglais par la palette (« Passer en anglais »), `html lang="en"`.
- Contrôle automatique sur chaque écran : texte visible et attributs `aria-label` / `placeholder` / `title` comparés à toutes les chaînes de `fr.json` qui diffèrent de `en.json`, titres saisis exclus. Écrans : tableau de bord Personal et Work (tuiles), ajout rapide (vide, menus Space / Due / Tags, après validation), liste avec « Completed », détail et menu Status, message de corbeille, corbeille.
- Aucun texte d'interface français. Seule détection : « Demain » dans « Demain pro QAagg3 », titre saisi au scénario 4 (contenu, pas interface).
- Titre « Réparer la fenêtre « été » QAil0n » identique dans la liste, le détail et la corbeille (`s7-d-05-liste.png`, `s7-d-06-detail.png`, `s7-d-09-corbeille.png`).
- Compte remis en français par la palette (« Switch to French ») ; `html lang="fr"`, nettoyage fait ensuite avec l'interface française. Attendu = obtenu.

### Échecs détaillés
- Aucun.

### Contrôles complémentaires (tous conformes)
- Retour arrière : détail ouvert depuis la liste (mobile) → Précédent ramène à `/tasks`, détail fermé ; Suivant le rouvre ; « Fermer » ramène à `/tasks` (`x-01`, `x-02`).
- Session expirée : cookies effacés, ajout rapide validé → renvoi vers `/login?next=%2Ftasks`, aucune tâche créée en base (`x-03-session-expiree.png`).
- États vides : Privé sans tâche → phrase vide + « Ajouter une tâche » qui ouvre l'ajout rapide ; Pro filtré Nexxia sans tâche → « Rien dans cet espace » + « Voir tous les espaces » qui repasse à « Les deux » (`x-04`, `x-05`).
- Double soumission : voir scénario 3.

### Hors spec mais observé
- Contenu saisi modifié à l'affichage : un « x » entre deux chiffres est rendu « × » par la police (« mwo3x0eig9n6 » affiché « mwo3×0eig9n6 », corbeille ordinateur et mobile : `s5-m-05-corbeille.png`, `s7-d-09-corbeille.png`). Probablement les alternances contextuelles de la police ; le texte en base est intact. Gênant pour une référence ou un code saisi (ex. « 3x2 »).
- Détail, Priorité « Aucune » : un petit point isolé tient lieu d'icône à gauche du libellé (`s5-m-01-deux-sous-taches.png`, `s7-d-06-detail.png`).
- Juste après « Tâche ajoutée », pastilles et bouton restent désactivés un instant avec le libellé « Ajout… » (rafraîchissement en cours) alors que le succès est déjà annoncé (`s1-m-06-apres-valider.png`). Bref, sans effet sur la saisie suivante.
- Mettre une sous-tâche à la corbeille depuis son détail renvoie à `/tasks`, pas au détail de la parente. La spec ne dit rien.
- Corbeille : environ 90 tâches laissées par les e2e (pas de suppression définitive), Privé et Pro mêlés, sans pagination. Liste longue à parcourir sur le compte e2e.
- Le tag « client » reste dans le compte e2e (les tags n'ont pas de corbeille) ; il existait déjà avant ce passage.
- Journal du serveur de dev : une erreur « The destination stream errored while writing data » au moment où le navigateur de test a été fermé pendant le rendu en flux du tableau de bord. Artefact du test, pas de l'app.

### Nettoyage
- Les 19 tâches créées (titres suffixés `QAxxxx`, sous-tâches comprises) sont à la corbeille, vérifié en base. Aucune autre donnée touchée. Compte e2e en français.
- Serveur de dev arrêté ; état de session des scripts supprimé du scratchpad.
