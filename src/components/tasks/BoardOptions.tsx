"use client";

// Curseurs nexxia-design (spec todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Options du tableau (spec todo-kanban, « Options du tableau ») : « Sous-tâches » et « Masquer les sous-tâches
// terminées », deux interrupteurs du modèle « Terminées » sur une rangée au-dessus du tableau. La seconde est sans
// effet quand la première est éteinte : elle est alors désactivée et garde sa valeur. Le composant ne lit rien : il
// reçoit les deux valeurs (cookies lus par la page) et appelle l'action. Préférences d'affichage (frontend.md
// « États ») : changement instantané, `aria-busy` pendant l'enregistrement, échec → retour à la valeur enregistrée
// et message. Repli : une ligne dès que les deux pastilles tiennent, deux lignes serrées en dessous (390 px).
import { useTranslations } from "next-intl";

import { PreferenceStatus } from "@/components/shell/PreferenceStatus";
import { useOptimisticPreference } from "@/components/shell/use-optimistic-preference";
import { setBoardOption } from "@/lib/preferences-actions";

import { BoardOptionSwitch } from "./BoardOptionSwitch";

const saveSubtasks = (next: boolean) => setBoardOption("subtasks", next);
const saveHideDone = (next: boolean) =>
  setBoardOption("hideDoneSubtasks", next);

type BoardOptionsProps = {
  /** Sous-tâches en cartes (cookie bmb_board_subtasks, lu par le serveur). */
  subtasks: boolean;
  /** Sous-tâches terminées masquées (cookie bmb_board_hide_done_subtasks, lu par le serveur). */
  hideDoneSubtasks: boolean;
};

export function BoardOptions({
  subtasks,
  hideDoneSubtasks,
}: BoardOptionsProps) {
  const t = useTranslations("tasks.board.options");
  const shownSubtasks = useOptimisticPreference(subtasks, saveSubtasks);
  const shownHideDone = useOptimisticPreference(hideDoneSubtasks, saveHideDone);

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="relative flex flex-wrap gap-x-2 gap-y-1.5"
    >
      <BoardOptionSwitch
        label={t("subtasks")}
        checked={shownSubtasks.shown}
        busy={shownSubtasks.pending}
        onToggle={() => shownSubtasks.update(!shownSubtasks.shown)}
      />
      <BoardOptionSwitch
        label={t("hideDoneSubtasks")}
        checked={shownHideDone.shown}
        busy={shownHideDone.pending}
        disabled={!shownSubtasks.shown}
        onToggle={() => shownHideDone.update(!shownHideDone.shown)}
      />
      <PreferenceStatus
        failed={shownSubtasks.failed || shownHideDone.failed}
        className="left-0"
      />
    </div>
  );
}
