"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Corbeille depuis le détail (spec todo-unifiee, « Détail », pied) : pas de confirmation (action réversible,
// PRODUCT.md), message « Tâche mise à la corbeille » + « Annuler » qui restaure (`tasks.restore`, sous-tâches
// mises avec elle comprises). Monté dans le layout de `/tasks` : le message survit à la fermeture du détail.
// Ordre : on quitte le détail d'abord, puis on écrit ; sinon le rafraîchissement d'après l'écriture rendrait la
// page 404 de la tâche disparue. Bulle opaque (`popover`, jamais de verre sur du verre) au-dessus de la barre
// d'onglets sur mobile, en bas à droite sur ordinateur ; `role="status"` toujours rendu pour l'annonce quand aucun
// détail n'est ouvert (sinon, la région est l'emplacement du détail).
// Mouvement : apparition `opacity` + `y` 8, ressort sans rebond, 0,3 s (DESIGN.md § 7) ; coupé par
// MotionConfig reducedMotion="user" (coque). Effacée après 8 s, sauf pendant son propre appel (« Annuler »), et
// dès qu'on quitte la page où elle s'affichait (elle ne revient pas en y retournant). Chaque réponse ne s'applique
// qu'à l'état qui l'attend (même tâche) : une réponse tardive d'une autre tâche ou d'une page quittée est ignorée.
// Sous-tâche (spec, « Détail », pied) : retour au détail de la parente ; le message s'y affiche DANS la fenêtre
// (emplacement fourni par le détail, `TrashNoticeHostContext`), sinon il serait inerte sous la fenêtre modale.
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { type AppActionResult, runAppAction } from "@/app/(app)/tasks/actions";
import { type Settled, settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import type { TaskErrorCode } from "@/modules/tasks/errors";

import { TrashNoticeHostContext, TrashTaskContext } from "./task-trash-context";

const DISMISS_MS = 8_000;
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

type NoticeKind =
  // Appel en cours : rien d'affiché, mais quitter sa page l'abandonne (le résultat ne s'affichera pas).
  | { kind: "pending"; taskId: string }
  // `undoing` : « Annuler » en cours pour cette tâche (bouton désactivé, minuteur suspendu). Propre au
  // message : un autre appel encore en vol (autre tâche) ne bloque ni le bouton ni le minuteur.
  | { kind: "trashed"; taskId: string; undoing?: boolean }
  | { kind: "restored" }
  | { kind: "trashFailed"; code?: TaskErrorCode }
  | { kind: "restoreFailed"; code?: TaskErrorCode };

/**
 * Message et page où il s'affiche (la liste, ou le détail de la parente d'une sous-tâche), jamais sur le détail
 * qu'on quitte. `seen` : déjà affiché ; quitter ensuite cette page l'efface.
 */
type Notice = NoticeKind & { href: string; seen: boolean };

/** Chemin d'une adresse, sans la requête (`?completed=1`) : c'est ce que rend `usePathname`. */
function pathOf(href: string): string {
  return href.split("?")[0];
}

type TaskTrashProviderProps = { children: React.ReactNode };

/** Code traduit d'un refus, absent pour une panne (message générique). */
function failureCode(
  outcome: Settled<AppActionResult>,
): TaskErrorCode | undefined {
  return outcome.ok && !outcome.value.ok ? outcome.value.code : undefined;
}

export function TaskTrashProvider({ children }: TaskTrashProviderProps) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  const here = notice !== null && pathOf(notice.href) === pathname;
  // Ajusté pendant le rendu (pas d'effet) : marqué vu sur sa page, effacé dès qu'on la quitte.
  if (notice !== null && here && !notice.seen) {
    setNotice({ ...notice, seen: true });
  } else if (notice !== null && !here && notice.seen) {
    setNotice(null);
  }

  const attachHost = useCallback((element: HTMLElement | null) => {
    // Ref avec nettoyage (React 19) : jamais rappelée avec null, gardé pour le type des refs.
    if (element === null) return undefined;
    setHost(element);
    return () => setHost((current) => (current === element ? null : current));
  }, []);

  useEffect(() => {
    if (
      notice === null ||
      !here ||
      notice.kind === "pending" ||
      (notice.kind === "trashed" && notice.undoing)
    ) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, here]);

  function trash(taskId: string, returnHref: string) {
    setNotice({ kind: "pending", taskId, href: returnHref, seen: false });
    router.push(returnHref, { scroll: false });
    void (async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.moveToTrash", { taskId }),
      );
      const result: NoticeKind =
        outcome.ok && outcome.value.ok
          ? { kind: "trashed", taskId }
          : { kind: "trashFailed", code: failureCode(outcome) };
      // Page quittée pendant l'appel (attente effacée) ou autre tâche mise à la corbeille depuis : ignoré.
      setNotice((current) =>
        current?.kind === "pending" && current.taskId === taskId
          ? { ...result, href: returnHref, seen: current.seen }
          : current,
      );
    })();
  }

  function undo(taskId: string, href: string) {
    setNotice((current) =>
      current?.kind === "trashed" && current.taskId === taskId
        ? { ...current, undoing: true }
        : current,
    );
    void (async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.restore", { taskId }),
      );
      const result: NoticeKind =
        outcome.ok && outcome.value.ok
          ? { kind: "restored" }
          : { kind: "restoreFailed", code: failureCode(outcome) };
      // Le message « mise à la corbeille » de cette tâche est encore là (page gardée) : sinon, ignoré.
      setNotice((current) =>
        current?.kind === "trashed" && current.taskId === taskId
          ? { ...result, href, seen: current.seen }
          : current,
      );
    })();
  }

  // L'écriture finit souvent avant la navigation : le message attend d'être sur sa page.
  const shown = here && notice.kind !== "pending" ? notice : null;
  const failed =
    shown?.kind === "trashFailed" || shown?.kind === "restoreFailed";

  const bubble = (
    <AnimatePresence>
      {shown !== null && (
        <motion.p
          key={shown.kind}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={SPRING}
          className={cn(
            "pointer-events-auto flex min-h-11 max-w-md items-center gap-x-3 rounded-lg bg-popover py-1 pr-1.5 pl-4 text-small font-medium shadow-glass",
            failed ? "text-destructive" : "text-foreground",
            shown.kind !== "trashed" && "pr-4",
          )}
        >
          <span className="py-2">
            {shown.kind === "trashed" && t("detail.trashed")}
            {shown.kind === "restored" && t("detail.restored")}
            {failed &&
              (shown.code !== undefined
                ? t(`errors.${shown.code}`)
                : t(
                    shown.kind === "trashFailed"
                      ? "detail.trashFailed"
                      : "detail.restoreFailed",
                  ))}
          </span>
          {shown.kind === "trashed" && (
            <motion.button
              type="button"
              disabled={shown.undoing === true}
              onClick={() => undo(shown.taskId, shown.href)}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="min-h-11 shrink-0 rounded-md px-3 text-small font-semibold text-link hover:text-link-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("detail.undo")}
            </motion.button>
          )}
        </motion.p>
      )}
    </AnimatePresence>
  );

  return (
    <TrashTaskContext value={trash}>
      <TrashNoticeHostContext value={attachHost}>
        {children}
      </TrashNoticeHostContext>
      {host !== null ? (
        // Dans la fenêtre du détail ouvert : la région `role="status"` est l'emplacement du détail lui-même.
        createPortal(bubble, host)
      ) : (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-page bottom-tabbar-reserve z-(--z-toast) flex justify-center lg:inset-x-auto lg:right-page lg:bottom-page"
        >
          {bubble}
        </div>
      )}
    </TrashTaskContext>
  );
}
