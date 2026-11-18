## QA — socle — 2026-11-18

Code testé : `feat/socle` à `a8701aa` (même code applicatif que `main` à `91caed4`, d'après la demande).
Captures (`qa/…`) : gardées en local, hors du dépôt public (`.gitignore`, décision d'Antoine du 2026-11-18).
Périmètre fixé par Antoine : scénarios 1, 2, 4 et 6 en local (branche Neon `dev`, compte e2e) ; passage sans connexion sur la production ; scénario 5 non joué.

| # | Scénario | Résultat | Preuve |
|---|---|---|---|
| 1 | Première connexion (desktop + mobile) | PASS | `qa/local-s1-dashboard-desktop.png`, `qa/local-s1-dashboard-mobile.png` ; e2e `premiere-connexion` 8/8 |
| 2 | Bascule Privé / Pro (desktop + mobile) | PASS | `qa/local-s2-pro-nexxia-desktop.png`, `qa/local-s2-pro-nexxia-mobile.png` ; e2e `bascule-prive-pro` 12/12 |
| 3 | Accès refusé (production, desktop) | PASS | `qa/prod-s3-dashboard-desktop.png`, `qa/prod-s3-settings-desktop.png` |
| 4 | Changer de langue (desktop + mobile) | PASS | `qa/local-s4-settings-en-desktop.png`, `qa/local-s4-settings-en-mobile.png` ; e2e `changer-de-langue` 2/2 |
| 5 | Installer l'app | NON JOUÉ | Validé par Antoine sur iPhone le 2026-11-17 (icône, plein écran, barre d'onglets, session conservée) ; essai Android reporté avant le multi-comptes (BRAIN-26) |
| 6 | Palette de commandes (desktop ⌘K + mobile bouton) | PASS | `qa/local-s6-palette-langue-desktop.png`, `qa/local-s6-palette-langue-mobile.png`, `qa/local-s6-dashboard-en-*.png` ; e2e `palette` 2/2 |
| B | Production sans connexion : connexion, installabilité, en-têtes | PASS | `qa/prod-login-desktop.png`, `qa/prod-login-iphone-webkit.png`, `qa/prod-login-en-browser.png` |

Captures : `docs/features/socle/qa/`. Aucune ne montre d'e-mail, de mot de passe ni d'hôte Neon (aucune capture prise après saisie du formulaire ; l'interface n'affiche pas l'e-mail).

### Environnements
- Local : `pnpm dev` (Next 16, http://localhost:3000), base = branche Neon `dev` via `.env` (non lu par le testeur), compte e2e. Desktop = Chromium 1440×900 ; mobile = Chromium avec émulation iPhone 15 (390×844), WebKit refusant les cookies `__Secure-` en http local.
- Production : https://bemybrain-nexxia.vercel.app, lecture seule : uniquement des GET, aucune saisie, aucun envoi de formulaire, aucun compte. Chromium desktop, WebKit iPhone 15, Chromium Pixel 7 (contexte persistant pour l'installabilité).
- Deux passages : la suite e2e du dépôt (`pnpm e2e` sur les 5 fichiers de scénarios, 1 worker : 31/31 verts, dépendances comprises : en-têtes de sécurité et installation) ; puis un passage exploratoire scripté (8/8), avec captures, console, réseau, cas limites.

### Scénario 1 — Première connexion — PASS
- `/` sans session → `/login` ; connexion → `/dashboard`, titre « Tableau de bord », tuile « Aujourd'hui » (« Mercredi 18 novembre », « Bonjour. », espace Privé, workspace BeMyBrain), tuiles Privé visibles, aucune tuile Pro.
- Desktop : bento, « Aujourd'hui » et To-do sur la même rangée. Mobile : une colonne, paire Courses/Budget sur une rangée, aucun débordement horizontal.
- Animation d'entrée jouée une fois par session ; mouvement réduit : aucune animation.
- Console : aucune erreur, aucune violation CSP, aucune requête 4xx/5xx.
- Double soumission du formulaire (double clic + Entrée) : une seule requête POST, arrivée normale sur le tableau de bord, aucune erreur.
- Écart avec la spec : le scénario part « de l'URL de production » ; joué en local par décision (pas de connexion en production).

### Scénario 2 — Bascule Privé / Pro — PASS
- Desktop : Pro → filtre de la barre latérale « Tous (2) » actif → Nexxia ; rechargement : Pro et Nexxia toujours actifs.
- Mobile : pastille à côté du titre → menu → Nexxia ; rechargement : « Nexxia » conservé. Échap ferme le menu et rend le focus.
- Côté Pro filtré : tuiles Aujourd'hui (« dans Nexxia »), Tâches pro (étiquette Nexxia), Clients, Finances pro, Réseaux.
- Côté Privé (un seul espace) : aucun filtre proposé.
- Bascules rapides Privé/Pro/Privé puis rechargement : l'état final (Privé) est bien celui enregistré.
- Console et réseau : rien.
- État remis sur Privé en fin de passage.

### Scénario 3 — Accès refusé (production) — PASS
- `/dashboard` et `/settings` sans session : 307 vers `/login`, puis écran « Connexion » seul : champs e-mail et mot de passe, bouton « Se connecter », un seul lien « Mot de passe oublié ? ». Ni navigation, ni titre « Tableau de bord », ni bouton de déconnexion.
- Console : aucune erreur, aucune violation CSP ; aucune requête en échec ; aucune requête autre que GET.
- Rejoué aussi en local par la suite e2e : PASS.

### Scénario 4 — Changer de langue — PASS
- Réglages → English : `lang="en"`, URL inchangée (`/settings`), titres et navigation en anglais. Rechargement : anglais conservé.
- Déconnexion (« Sign out ») → `/login` en anglais ; reconnexion depuis un navigateur vierge réglé en français : tableau de bord en anglais (langue lue en base).
- Texte visible relevé en anglais : Personal / Work, Home, Settings, Sign out, Dashboard, tuiles (To-do, Groceries, Budget, Health, Home), réglages, libellés accessibles (« Main navigation », « Open command palette », « Side shown »).
- Date au format anglais : « Wednesday, November 18 ». Nombres : aucun nombre affiché à ce stade (tuiles vides), format non vérifiable.
- Desktop et mobile ; console et réseau : rien. Compte remis en français à la fin (vérifié : `lang="fr"`).

### Scénario 5 — Installer l'app — NON JOUÉ
- Validé par Antoine sur iPhone le 2026-11-17 (icône, plein écran, barre d'onglets, session conservée) ; essai Android reporté avant le multi-comptes (BRAIN-26).
- Vérifié en complément sur la production, sans connexion (voir B) : manifeste valide, icônes présentes, audit d'installabilité Chrome sans erreur.

### Scénario 6 — Palette de commandes — PASS
- Desktop : ⌘K ouvre la palette ; « langue » → une seule action, « Passer en anglais » ; activation → `lang="en"`, URL `/dashboard` inchangée, palette fermée, tableau de bord en anglais.
- Mobile : bouton « + » de la barre basse → même parcours, même résultat.
- Console et réseau : rien. Compte remis en français à la fin.

### B — Production sans connexion — PASS
- Page de connexion (Chromium desktop, WebKit iPhone 15) : 200, `lang="fr"`, titre « Connexion », formulaire complet, aucune erreur console, aucune violation CSP émise par l'application, aucun débordement horizontal en mobile. Navigateur en anglais : page en anglais (« Sign in »).
- En-têtes (`/login`, `/dashboard`, `/settings`) :
  - CSP à nonce : `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'nonce-…'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` ; nonce différent à chaque requête.
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`.
- Installabilité :
  - `/manifest.webmanifest` 200 (`application/manifest+json`) : nom, `start_url` `/dashboard`, `scope` `/`, `display` `standalone`, couleurs, 3 icônes dont une maskable.
  - Icônes : 192×192, 512×512, maskable 512×512, `apple-touch-icon` 180×180, favicon : toutes en 200, dimensions conformes.
  - `<head>` : `link rel="manifest"`, `theme-color`, `viewport-fit=cover`, `mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-touch-icon`.
  - Chrome (Pixel 7, `launchPersistentContext` sur dossier temporaire) : `Page.getInstallabilityErrors` → aucune erreur ; `Page.getAppManifest` → aucune erreur d'analyse.

### Échecs détaillés
- Aucun.

### Hors spec mais observé
- Session expirée pendant une action : cookies effacés, puis clic sur « Pro ». L'interface revient sur Privé et affiche « Choix non enregistré. Réessaie. » (`qa/local-session-expiree-action-*.png`), sans renvoyer vers la connexion. Un nouvel essai échouera de la même façon ; seule la navigation suivante mène à `/login`. Pas de plantage ni d'erreur console. À trancher : rediriger vers `/login` quand l'action échoue faute de session.
- Utilisateur connecté qui ouvre `/login` (ou revient en arrière depuis le tableau de bord) : le formulaire de connexion s'affiche au lieu de renvoyer vers `/dashboard`. Sans gravité.
- Retour arrière après déconnexion : reste sur l'écran de connexion, aucun contenu de l'app réaffiché (`qa/local-retour-apres-deconnexion-*.png`). Conforme.
- Interface en anglais : le nom de l'espace reste « Privé » (« Nothing planned today in Privé »). C'est une donnée du compte, pas un texte d'interface ; à garder en tête si les noms d'espace par défaut doivent suivre la langue.
- Pas de `apple-mobile-web-app-capable` dans le `<head>` (piège connu de Next 16) ; plein écran iOS confirmé par Antoine le 2026-11-17, rien à faire.
- Aucun service worker enregistré : sans effet sur l'installabilité Chrome (aucune erreur remontée) ; pas de mode hors ligne.
- Artefact d'outil, pas un défaut : sous WebKit, `page.screenshot` de Playwright injecte une feuille de style et déclenche une violation CSP `style-src-elem` ; reproduit 3 fois sur 3 au moment de la capture, absent sur 6 chargements sans capture.
- Captures pleine page : la barre d'onglets mobile (fixe) apparaît au milieu de l'image, et le badge « N » des outils de dev Next figure sur les captures locales. Artefacts de capture, pas des défauts.
- Dev : avertissement Sentry au démarrage (« `tunnelRoute` option is deprecated »), hors interface.
