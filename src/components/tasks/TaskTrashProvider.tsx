"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Corbeille depuis le détail (spec todo-unifiee, « Détail », pied) : pas de confirmation (action réversible,
// PRODUCT.md), message « Tâche mise à la corbeille » + « Annuler » qui restaure (`tasks.restore`, sous-tâches
// mises avec elle comprises). Monté dans le layout de `/tasks` : le message survit à la fermeture du détail.
// Ordre : on quitte le détail d'abord, puis on écrit ; sinon le rafraîchissement d'après l'écriture rendrait la
// page 404 de la tâche disparue. Bulle opaque (`popover`, jamais de verre sur du verre) au-dessus de la barre
// d'onglets sur mobile, en bas à droite sur ordinateur ; `role="status"` toujours rendu pour l'annonce.
// Mouvement : apparition `opacity` + `y` 8, ressort sans rebond, 0,3 s (DESIGN.md § 7) ; coupé par
// MotionConfig reducedMotion="user" (coque). Effacée après 8 s, sauf pendant un appel.
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { type AppActionResult, runAppAction } from "@/app/(app)/tasks/actions";
import { type Settled, settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import type { TaskErrorCode } from "@/modules/tasks/errors";

import { TrashTaskContext } from "./task-trash-context";

const DISMISS_MS = 8_000;
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

type NoticeKind =
  | { kind: "trashed"; taskId: string }
  | { kind: "restored" }
  | { kind: "trashFailed"; code?: TaskErrorCode }
  | { kind: "restoreFailed"; code?: TaskErrorCode };

/** Message et page où il s'affiche (la liste) : jamais sur le détail encore ouvert, où il serait inerte. */
type Notice = NoticeKind & { href: string };

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
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (notice === null || pending || notice.href !== pathname) return;
    const timer = setTimeout(() => setNotice(null), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, pending, pathname]);

  function trash(taskId: string, returnHref: string) {
    setNotice(null);
    router.push(returnHref, { scroll: false });
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.moveToTrash", { taskId }),
      );
      setNotice(
        outcome.ok && outcome.value.ok
          ? { kind: "trashed", taskId, href: returnHref }
          : {
              kind: "trashFailed",
              code: failureCode(outcome),
              href: returnHref,
            },
      );
    });
  }

  function undo(taskId: string, href: string) {
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.restore", { taskId }),
      );
      setNotice(
        outcome.ok && outcome.value.ok
          ? { kind: "restored", href }
          : { kind: "restoreFailed", code: failureCode(outcome), href },
      );
    });
  }

  // L'écriture finit souvent avant la navigation vers la liste : le message attend d'y être.
  const shown = notice !== null && notice.href === pathname ? notice : null;
  const failed =
    shown?.kind === "trashFailed" || shown?.kind === "restoreFailed";

  return (
    <TrashTaskContext value={trash}>
      {children}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-page bottom-tabbar-reserve z-(--z-toast) flex justify-center lg:inset-x-auto lg:right-page lg:bottom-page"
      >
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
                  disabled={pending}
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
      </div>
    </TrashTaskContext>
  );
}
