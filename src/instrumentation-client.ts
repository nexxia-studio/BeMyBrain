// Sentry côté navigateur (plan socle, tâche 19) : chargement différé, le SDK n'est importé que si Sentry est
// actif (src/lib/sentry-client.ts), jamais dans le bundle initial (tests/build/initial-bundle.test.ts).
// Pas de tracing, pas d'enregistrement d'écran ; suivi de session sans IP. Options et nettoyage : src/lib/sentry-options.ts.
import { loadSentry } from "@/lib/sentry-client";

// Import du SDK échoué (réseau, déploiement remplacé) : une ligne en console, pas de rejet non géré ;
// loadSentry a oublié la promesse, la prochaine erreur signalée retentera le chargement.
loadSentry()?.catch((failure: unknown) => {
  console.error("Sentry non chargé au démarrage", failure);
});
