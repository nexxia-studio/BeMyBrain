"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Contenu de la palette : recherche (Autocomplete de Base UI en ligne, motif « command palette » de sa
// documentation ; aucune dépendance ajoutée), groupes « Tâches » (saisie libre → « Ajouter la tâche « … » »
// en premier, `tasks.create` avec le côté et l'espace courants ; « Nouvelle tâche » ouvre l'ajout rapide ;
// liste et corbeille), « Aller à » (raccourcis de navigation, hors registre) et « Actions » (actions du
// registre, lancées par la Server Action unique runAction, origine `palette`). Pas d'optimiste : la palette
// se ferme au succès. Entrée lance la commande en surbrillance (la première au départ). Une saisie trouve
// toujours au moins l'ajout de la tâche : pas d'état « aucun résultat ». Focus visible (DESIGN.md § 11), un seul anneau à la fois : la rangée de recherche
// porte le focus par sa bordure basse (`ring`), le champ n'a pas d'outline ; l'option en surbrillance porte un
// anneau intérieur `ring` au clavier (la piste `pill-track` seule reste sous 3:1 sur `popover`), retiré au
// doigt (`pointer-coarse`) où la piste suffit. La page courante reste listée, marquée `aria-current` et d'une
// pastille « Ici » (masquée aux lecteurs d'écran, qui annoncent déjà `aria-current`). Pas de bouton Fermer : Échap et clic dehors ferment
// (Dialog de Base UI). Pendant une action : commandes désactivées, état annoncé ; échec : message,
// la palette reste ouverte.
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { runAction } from "@/app/(app)/actions";
import { useOpenQuickAdd } from "@/components/quick-add/quick-add-context";
import { isActivePath } from "@/components/shell/nav-items";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";

import {
  matchesCommand,
  type PaletteCommand,
  type PaletteGroupKey,
  type PaletteScope,
  paletteGroups,
} from "./commands";

type PaletteItem = PaletteCommand & {
  label: string;
  keywords: string;
  /** Vrai pour l'entrée de navigation de la page affichée. */
  current: boolean;
};
type PaletteGroup = { value: PaletteGroupKey; items: PaletteItem[] };

type PalettePanelProps = {
  /** Côté et espace courants : la tâche ajoutée depuis la palette les prend. */
  scope: PaletteScope;
  /** Ferme la palette (commande lancée avec succès). */
  onDone: () => void;
};

export function PalettePanel({ scope, onDone }: PalettePanelProps) {
  const t = useTranslations("palette");
  const tShell = useTranslations("shell");
  const currentLocale = useLocale();
  const router = useRouter();
  const openQuickAdd = useOpenQuickAdd();
  const pathname = usePathname();
  const hintId = useId();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  function toItem(command: PaletteCommand): PaletteItem {
    if (command.kind === "action" && command.action === "tasks.create")
      return {
        ...command,
        // Saisie de l'utilisateur : affichée telle quelle, jamais traduite.
        label: t("commands.addTask", { title: command.title }),
        keywords: "",
        current: false,
      };
    if (command.kind === "navigate" && command.keywordsKey === undefined)
      return {
        ...command,
        label: tShell(command.labelKey),
        keywords: t("navigationKeywords"),
        current: isActivePath(pathname, command.href),
      };
    return {
      ...command,
      label: t(`commands.${command.labelKey}`),
      keywords: t(`commands.${command.keywordsKey}`),
      current: command.kind === "navigate" && pathname === command.href,
    };
  }

  const groups: PaletteGroup[] = paletteGroups(
    isLocale(currentLocale) ? currentLocale : defaultLocale,
    { query, scope },
  )
    .map(({ value, commands }) => ({ value, items: commands.map(toItem) }))
    .filter((group) => group.items.length > 0);

  function launch(item: PaletteItem) {
    if (pending) return;
    setFailed(false);
    if (item.kind === "navigate") {
      onDone();
      router.push(item.href);
      return;
    }
    if (item.kind === "quickAdd") {
      onDone();
      openQuickAdd();
      return;
    }
    startTransition(async () => {
      // Rejet de l'appel = échec ; session expirée : renvoi vers /login relancé, Next navigue.
      const outcome = await settleAction(() =>
        runAction(item.action, item.params),
      );
      if (outcome.ok && outcome.value.ok) onDone();
      else setFailed(true);
    });
  }

  return (
    <Autocomplete.Root
      open
      inline
      items={groups}
      value={query}
      onValueChange={setQuery}
      // L'ajout de la tâche reprend la saisie : toujours retenu.
      filter={(item: PaletteItem, query) =>
        item.kind === "action" && item.action === "tasks.create"
          ? true
          : matchesCommand(item, query)
      }
      itemToStringValue={(item: PaletteItem) => item.label}
      autoHighlight="always"
      keepHighlight
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 focus-within:border-ring">
        <Search
          aria-hidden="true"
          className="size-4.5 shrink-0 text-muted-foreground"
          strokeWidth={2}
        />
        <Autocomplete.Input
          aria-label={t("search")}
          aria-describedby={hintId}
          placeholder={t("placeholder")}
          className="min-h-13 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div
        aria-busy={pending}
        className="max-h-80 overflow-y-auto overscroll-contain p-2"
      >
        <Autocomplete.List>
          {(group: PaletteGroup) => (
            <Autocomplete.Group
              key={group.value}
              items={group.items}
              className="not-last:mb-2"
            >
              <Autocomplete.GroupLabel className="px-3 pt-2 pb-1.5 text-eyebrow text-muted-foreground uppercase">
                {t(`groups.${group.value}`)}
              </Autocomplete.GroupLabel>
              <Autocomplete.Collection>
                {(item: PaletteItem) => (
                  <Autocomplete.Item
                    key={item.id}
                    value={item}
                    disabled={pending}
                    onClick={() => launch(item)}
                    aria-current={item.current ? "page" : undefined}
                    className="flex min-h-11 cursor-default items-center gap-3 rounded-lg px-3 text-body font-semibold text-foreground outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-60 data-highlighted:bg-pill-track data-highlighted:ring-2 data-highlighted:ring-ring data-highlighted:ring-inset pointer-coarse:data-highlighted:ring-0"
                  >
                    <item.icon
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.current && (
                      <span
                        aria-hidden="true"
                        className="ml-auto shrink-0 text-caption font-medium text-muted-foreground"
                      >
                        {t("current")}
                      </span>
                    )}
                  </Autocomplete.Item>
                )}
              </Autocomplete.Collection>
            </Autocomplete.Group>
          )}
        </Autocomplete.List>
      </div>

      {/* Pied : aide clavier sur ordinateur ; sur mobile, visible seulement pour annoncer un état (la zone
          role="status" reste dans le DOM pour les lecteurs d'écran). */}
      <div
        className={cn(
          "flex min-h-11 items-center justify-between gap-3 border-t border-border px-4 py-2",
          !failed && !pending && "max-lg:sr-only",
        )}
      >
        <p
          id={hintId}
          className="sr-only text-caption text-muted-foreground lg:not-sr-only"
        >
          {t.rich("hint", {
            kbd: (chunks) => (
              <kbd className="rounded-sm bg-chip-neutral px-1.5 py-0.5 font-sans text-caption font-semibold text-chip-neutral-foreground">
                {chunks}
              </kbd>
            ),
          })}
        </p>
        <p
          role="status"
          data-testid="palette-status"
          className={cn(
            "text-small font-medium",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {failed ? t("error") : pending ? t("pending") : null}
        </p>
      </div>
    </Autocomplete.Root>
  );
}
