"use client";

// Curseurs nexxia-design (DESIGN.md § 1, détail) : VARIANCE 3 · MOTION 2 · DENSITY 6.
// Liste de sélection de tâche (parente, relations), spec « Listes de sélection » : recherche par titre dans les
// tâches actives d'un côté, `Autocomplete` de Base UI posé en ligne (aucune dépendance ajoutée). Le contenant
// (popup ou section du détail) appartient à l'appelant : il monte le champ au geste de l'utilisateur et rend le
// focus à son déclencheur quand `onCancel` (Échap) ou `onSelect` est appelé. Si le contenant est un popup sur
// iPhone, le focus du champ doit être posé dans le geste (relais de `QuickAddProvider`, docs/gotchas.md) ;
// monté en ligne dans le panneau, le tap sur le champ ouvre le clavier de lui-même.
// Lecture : `tasks.list` par `runAppAction` (filtrée sur le workspace de la session par le module). Sans
// recherche : tâches ouvertes seulement. Avec recherche : ouvertes d'abord, puis terminées et annulées pour
// compléter jusqu'à 20 (deux lectures, plutôt qu'un tri dédié : `tasks.list` reste inchangée).
// Le filtrage est celui du serveur (`filter={null}`) ; les exclusions sont retirées ici, la limite des
// lectures est relevée d'autant pour que 20 lignes restent proposées.
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import type { Task } from "@/modules/tasks/queries";
import type { Side } from "@/modules/core/sides";
import {
  openStatusCategories,
  TASK_LIST_MAX_LIMIT,
} from "@/modules/tasks/sides";

import { chipItemClass } from "./chip-styles";
import { contextChipClass } from "./context-chip-class";
import { STATUS_ICONS } from "./status-icons";

export const PICKER_MAX_RESULTS = 20;
const SEARCH_DELAY_MS = 250;
const CLOSED_CATEGORIES = ["completed", "canceled"] as const;

type TaskPickerProps = {
  /** Côté de la tâche ouverte : la liste n'en propose jamais d'autre. */
  side: Side;
  /** La tâche ouverte elle-même et celles à ne pas proposer (déjà reliées par ce type). */
  excludeIds: readonly string[];
  /** Vrai pour une parente : tâches de premier niveau seulement. */
  topLevelOnly?: boolean;
  onSelect: (task: Task) => void;
  /** Échap : l'appelant ferme la liste et rend le focus au déclencheur. */
  onCancel: () => void;
};

type Loaded =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; tasks: Task[] };

export function TaskPicker({
  side,
  excludeIds,
  topLevelOnly,
  onSelect,
  onCancel,
}: TaskPickerProps) {
  const t = useTranslations("tasks");
  const hintId = useId();
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  // Une réponse tardive d'une frappe précédente ne remplace jamais la dernière.
  const latest = useRef(0);
  // Les exclusions changent de référence à chaque rendu de l'appelant : lues par la ref, hors des dépendances.
  const excluded = useRef(excludeIds);
  useEffect(() => {
    excluded.current = excludeIds;
  });

  useEffect(() => {
    const request = ++latest.current;
    const search = query.trim();
    const run = async () => {
      const limit = Math.min(
        TASK_LIST_MAX_LIMIT,
        PICKER_MAX_RESULTS + excluded.current.length,
      );
      const read = async (statusCategories?: readonly string[]) => {
        const settled = await settleAction(() =>
          runAppAction("tasks.list", {
            side,
            limit,
            ...(search === "" ? {} : { query: search }),
            ...(statusCategories === undefined ? {} : { statusCategories }),
            ...(topLevelOnly === true ? { topLevelOnly: true } : {}),
          }),
        );
        if (!settled.ok || !settled.value.ok) return null;
        const result = settled.value.result as { tasks: Task[] };
        return result.tasks.filter(
          (task) => !excluded.current.includes(task.id),
        );
      };
      const open = await read(search === "" ? undefined : openStatusCategories);
      if (open === null) return "failed" as const;
      let found = open.slice(0, PICKER_MAX_RESULTS);
      if (search !== "" && found.length < PICKER_MAX_RESULTS) {
        const closed = await read(CLOSED_CATEGORIES);
        if (closed === null) return "failed" as const;
        found = [...found, ...closed].slice(0, PICKER_MAX_RESULTS);
      }
      return found;
    };
    const timer = setTimeout(
      () => {
        void run().then((outcome) => {
          if (request !== latest.current) return;
          setLoaded(
            outcome === "failed"
              ? { state: "failed" }
              : { state: "ready", tasks: outcome },
          );
        });
      },
      query === "" ? 0 : SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [query, side, topLevelOnly]);

  const items = loaded.state === "ready" ? loaded.tasks : [];
  const status =
    loaded.state === "loading"
      ? t("picker.loading")
      : loaded.state === "failed"
        ? t("picker.failed")
        : items.length === 0
          ? t("picker.empty")
          : "";

  return (
    <Autocomplete.Root
      open
      inline
      items={items}
      value={query}
      onValueChange={(value, details) => {
        // Choisir une ligne ne réécrit pas la recherche : seule la saisie la change.
        if (
          details.reason === "input-change" ||
          details.reason === "input-clear"
        ) {
          setQuery(value);
          // Pendant le délai de la frappe, ni l'ancien résultat ni l'ancienne erreur.
          setLoaded({ state: "loading" });
        }
      }}
      filter={null}
      itemToStringValue={(task: Task) => task.title}
      autoHighlight="always"
      keepHighlight
    >
      <div className="flex items-center gap-2.5 border-b border-border px-3 focus-within:border-ring">
        <Search
          aria-hidden="true"
          className="size-4.5 shrink-0 text-muted-foreground"
          strokeWidth={2}
        />
        <Autocomplete.Input
          aria-label={t("picker.label")}
          aria-describedby={hintId}
          placeholder={t("picker.placeholder")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              // Le tiroir du détail (Dialog de Base UI) écoute Échap sur le document : sans cela il se fermerait.
              event.stopPropagation();
              onCancel();
            }
          }}
          // 16 px au moins (`text-base`) : sinon Safari iOS zoome au focus.
          className="min-h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Autocomplete.List
        aria-busy={loaded.state === "loading"}
        className="max-h-72 overflow-y-auto overscroll-contain p-1"
      >
        {(task: Task) => (
          <Autocomplete.Item
            key={task.id}
            value={task}
            onClick={() => onSelect(task)}
            className={cn(chipItemClass, "justify-between")}
          >
            <PickerRow task={task} />
          </Autocomplete.Item>
        )}
      </Autocomplete.List>
      {/* Zone de message propre à la liste : Base UI ajoute ses propres `role="status"` (docs/gotchas.md). */}
      <p
        id={hintId}
        role="status"
        data-testid="picker-status"
        className={cn(
          "px-3 py-3 text-small text-muted-foreground",
          status === "" && "sr-only",
        )}
      >
        {status}
      </p>
    </Autocomplete.Root>
  );
}

function PickerRow({ task }: { task: Task }) {
  const t = useTranslations("tasks");
  const { icon: Icon, iconClass } = STATUS_ICONS[task.statusCategory];
  return (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon
          role="img"
          aria-label={t(`detail.status.${task.statusCategory}`)}
          className={cn("size-4.5 shrink-0", iconClass)}
          strokeWidth={2}
        />
        <span className="min-w-0 truncate">{task.title}</span>
      </span>
      {task.contextName !== null && task.contextColor !== null && (
        <span
          className={cn(
            "max-w-32 shrink-0 truncate",
            contextChipClass(task.contextColor),
          )}
        >
          {task.contextName}
        </span>
      )}
    </>
  );
}
