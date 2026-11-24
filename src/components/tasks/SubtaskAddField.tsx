"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Champ « Ajouter une sous-tâche » du détail (BRAIN-46, D8), commun au vrai détail (`SubtaskList`) et à la démo du
// kanban : toujours affiché, même sans sous-tâche. Une ligne de sous-tâche à venir : mêmes dimensions qu'une ligne
// (`TASK_ROW_LINE_CLASSES`), icône « + » à la place de la case, surface du champ de la charte (DESIGN.md § 5,
// Champs : `border-input bg-row`, `text-base` pour éviter le zoom d'iOS). Écart assumé à « libellé visible
// au-dessus » (décision d'Antoine, second essai iPhone) : le libellé reste dans le DOM (`sr-only`), l'icône et le
// texte d'invite le montrent. Anneau de focus porté par la ligne entière, pas par le champ nu.
// Entrée envoie ; pendant l'appel le champ passe en lecture seule (jamais `disabled`, qui ferait perdre le focus et
// fermer le clavier d'iOS) ; succès : vidé, prêt pour la suivante ; échec : saisie gardée, message sous la ligne.
// Aucune animation : le retour visible est la ligne qui apparaît dans la liste (DESIGN.md § 7).
// Sans logique de données : l'appelant ajoute (`onAdd`) et rend le message d'échec déjà traduit.
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { TASK_TITLE_MAX } from "@/modules/tasks/sides";

import { TASK_ROW_LINE_CLASSES } from "./task-list-layout";

type SubtaskAddFieldProps = {
  /** Ajoute la sous-tâche (titre tel que saisi, non vide). Rend `null`, ou le message d'échec à afficher. */
  onAdd: (title: string) => Promise<string | null>;
};

export function SubtaskAddField({ onAdd }: SubtaskAddFieldProps) {
  const t = useTranslations("tasks");
  const errorId = useId();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim() === "" || pending) return;
    setError(null);
    startTransition(async () => {
      const failure = await onAdd(title);
      // Après un `await`, une mise à jour sort de la transition : remise dedans, pour que le champ se vide au
      // moment même où il redevient modifiable (sinon vidé d'abord, et la frappe suivante est perdue).
      startTransition(() => {
        if (failure === null) setTitle("");
        else setError(failure);
      });
    });
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-1.5">
      <label
        className={cn(
          TASK_ROW_LINE_CLASSES,
          "cursor-text items-center rounded-lg border border-input bg-row has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-read-only:opacity-60",
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
          <Plus aria-hidden="true" className="size-4.5" strokeWidth={2} />
        </span>
        <span className="sr-only">{t("detail.subtasks.add")}</span>
        <input
          type="text"
          value={title}
          readOnly={pending}
          maxLength={TASK_TITLE_MAX}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t("detail.subtasks.add")}
          aria-describedby={error !== null ? errorId : undefined}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {error !== null && (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
