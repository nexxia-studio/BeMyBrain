---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
  - "tests/**"
---
# Règles tests

- Nom du test = comportement en français lisible : `it("refuse une réservation si le cours est complet")`.
- Arrange / Act / Assert séparés par une ligne vide. Un comportement par test.
- Données : factories dans `tests/factories/`, jamais de fixtures copiées-collées de 80 lignes.
- Base : tests d'intégration et d'isolation contre une branche Neon de test via `DATABASE_TEST_URL`, jamais contre `main`.
- RLS : au moins un test par table, connecté avec le rôle `app_backend` et les claims posés à la main (`set_config('request.jwt.claims', …, true)`), sans filtre applicatif, qui prouve qu'un utilisateur d'un autre workspace ne lit ni n'écrit rien.
- E2E (Playwright) : un fichier par parcours utilisateur de la spec, sélecteurs par rôle ou `data-testid`, jamais par classe CSS.
- Interdit : `test.skip`, `test.only`, `--no-verify`, `expect(true).toBe(true)`, `sleep()` fixe pour attendre l'UI.
- Le cycle rouge → vert est celui du skill `test-driven-development` ; ne pas le réinventer ici.
