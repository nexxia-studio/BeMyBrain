"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Contenu de la palette : recherche (Autocomplete de Base UI en ligne, motif « command palette » de sa
// documentation ; aucune dépendance ajoutée), groupes « Aller à » (raccourcis de navigation, hors registre)
// et « Actions » (actions du registre, lancées par la Server Action unique runAction). Entrée lance la
// commande en surbrillance. Pendant une action : commandes désactivées, état annoncé ; échec : message,
// la palette reste ouverte.
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { runAction, type RunActionResult } from "@/app/(app)/actions";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

import {
  matchesCommand,
  type PaletteCommand,
  paletteCommands,
} from "./commands";

type PaletteItem = PaletteCommand & { label: string; keywords: string };
type PaletteGroup = { value: "navigation" | "actions"; items: PaletteItem[] };

type PalettePanelProps = {
  /** Ferme la palette (commande lancée avec succès). */
  onDone: () => void;
};

const FAILED: RunActionResult = { ok: false };

export function PalettePanel({ onDone }: PalettePanelProps) {
  const t = useTranslations("palette");
  const tShell = useTranslations("shell");
  const currentLocale = useLocale();
  const router = useRouter();
  const hintId = useId();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const { navigation, actions } = paletteCommands(
    isLocale(currentLocale) ? currentLocale : defaultLocale,
  );
  const groups: PaletteGroup[] = [
    {
      value: "navigation" as const,
      items: navigation.map((command) => ({
        ...command,
        label: tShell(command.labelKey),
        keywords: t("navigationKeywords"),
      })),
    },
    {
      value: "actions" as const,
      items: actions.map((command) => ({
        ...command,
        label: t(`commands.${command.labelKey}`),
        keywords: t(`commands.${command.keywordsKey}`),
      })),
    },
  ].filter((group) => group.items.length > 0);

  function launch(item: PaletteItem) {
    if (pending) return;
    setFailed(false);
    if (item.kind === "navigate") {
      onDone();
      router.push(item.href);
      return;
    }
    startTransition(async () => {
      const outcome = await runAction(item.action, item.params).catch(
        () => FAILED,
      );
      if (outcome.ok) onDone();
      else setFailed(true);
    });
  }

  return (
    <Autocomplete.Root
      open
      inline
      items={groups}
      filter={(item: PaletteItem, query) => matchesCommand(item, query)}
      itemToStringValue={(item: PaletteItem) => item.label}
      autoHighlight="always"
      keepHighlight
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4">
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
      <Dialog.Close className="sr-only">{t("close")}</Dialog.Close>

      <div
        aria-busy={pending}
        className="max-h-80 overflow-y-auto overscroll-contain p-2"
      >
        <Autocomplete.Empty>
          <p className="px-3 py-6 text-small text-muted-foreground">
            {t("empty")}
          </p>
        </Autocomplete.Empty>
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
                    className="flex min-h-11 cursor-default items-center gap-3 rounded-lg px-3 text-body font-semibold text-foreground outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-60 data-highlighted:bg-pill-track"
                  >
                    <item.icon
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                    <span className="min-w-0 truncate">{item.label}</span>
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
          {t("hint")}
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
