---
name: qa
description: Lance l'agent qa-tester sur les scénarios d'une feature dans un vrai navigateur et renvoie le rapport pass/fail. À lancer quand toutes les tâches du plan sont implémentées et relues, avant de merger.
argument-hint: "<nom-de-la-feature> [url de l'app, défaut : celle de pnpm dev]"
disable-model-invocation: true
---

Feature à tester : **$ARGUMENTS**

1. Vérifie que `docs/features/<nom>/spec.md` a une section « Scénarios utilisateur ». Sinon, dis-le et propose de la compléter d'abord : on ne teste pas sans scénarios écrits.
2. Vérifie que l'app est joignable à l'URL donnée. Sans URL : lance `pnpm dev` en arrière-plan et prends l'URL qu'il affiche (Vite 5173, Astro 4321, Next 3000).
3. Dispatche l'agent `qa-tester` avec : « Joue tous les scénarios de docs/features/<nom>/spec.md sur <url>. Écris le rapport dans docs/features/<nom>/qa-report.md. »
4. À son retour, affiche le tableau PASS/FAIL tel quel.
5. S'il y a des FAIL : pour chacun, crée une tâche de correction dans `plan.md` (section « Corrections QA ») avec les étapes de reproduction. Ne corrige rien dans cette session : chaque correction = un `implementer` à part.
6. Site public : lance aussi `npx lighthouse@12 <url> --only-categories=performance,accessibility,seo --quiet --chrome-flags="--headless=new" --output=json --output-path=docs/features/<nom>/lighthouse.json` et reporte les trois scores (`jq '.categories|map_values(.score)'`). Sous 90 = une tâche de correction ; sur un staging `noindex`, ignorer le score SEO. Vérifie que `/robots.txt`, le sitemap (`/sitemap-index.xml` Astro, `/sitemap.xml` Shopify / Next) et `/llms.txt` (sauf Shopify) répondent 200, et extrais le JSON-LD (`curl -s <url> | grep -o '<script type="application/ld+json">.*</script>'`) pour le coller dans validator.schema.org ou le relire à la main.
7. Si tout passe : dis-le en une ligne et propose `finishing-a-development-branch` (superpowers).
