// Tags du workspace pour la pastille Tags (`tasks.listTags`, registre d'actions, origine `app`). Hors de
// `TagsChip` : la pastille ne dépend d'aucune Server Action et sert aussi là où il n'y en a pas (démo du kanban).
import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";

/** Noms des tags renvoyés par `tasks.listTags` (forme vérifiée : la Server Action renvoie `unknown`). */
function tagNames(result: unknown): string[] | null {
  if (!Array.isArray(result)) return null;
  const names = result.map((tag: unknown) =>
    typeof tag === "object" && tag !== null && "name" in tag
      ? tag.name
      : undefined,
  );
  return names.every((name) => typeof name === "string") ? names : null;
}

/** Noms des tags du workspace, `null` si la lecture échoue. */
export async function loadWorkspaceTags(): Promise<string[] | null> {
  const outcome = await settleAction(() => runAppAction("tasks.listTags", {}));
  return outcome.ok && outcome.value.ok ? tagNames(outcome.value.result) : null;
}
