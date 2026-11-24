// Démo du kanban (BRAIN-46) : jamais accessible en production.
// Ouverte seulement en développement local (`pnpm dev`) et sur une preview Vercel. Un build de production
// hors Vercel (`next start`, e2e) reste fermé, comme la production.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban, une fois le glisser jugé.

type DemoEnv = {
  NODE_ENV: string | undefined;
  VERCEL_ENV: string | undefined;
};

export function isKanbanDemoEnabled(env: DemoEnv): boolean {
  if (env.VERCEL_ENV !== undefined) return env.VERCEL_ENV === "preview";
  return env.NODE_ENV === "development";
}
