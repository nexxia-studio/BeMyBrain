"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Interrupteur « Terminées » de l'en-tête de la liste : montre ou masque les tâches terminées et annulées.
// État dans l'adresse (`?completed=1`, posé par la page serveur qui donne `href`) : relu par la page,
// partageable, sans écriture. Pastille en verre posée sur le fond nu, comme le filtre d'espace mobile (DESIGN.md § 8, déc. 6) ; piste `pill-track`
// bordée `input` éteinte (≥ 3:1), pleine en `primary` allumée. Geste répété : changement instantané, `aria-busy` pendant le rendu serveur.
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

type CompletedToggleProps = {
  checked: boolean;
  /** Adresse de la liste avec l'état inverse. */
  href: string;
};

export function CompletedToggle({ checked, href }: CompletedToggleProps) {
  const t = useTranslations("tasks.list");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(() => router.replace(href, { scroll: false }));
  }

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={pending}
      onClick={toggle}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className="glass flex min-h-11 items-center gap-2.5 rounded-full pr-3 pl-4 text-small font-semibold text-foreground"
    >
      {t("completedToggle")}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-9 shrink-0 items-center rounded-full",
          // Éteint : piste pâle sur le verre (≈ 1,1:1), bordée comme les champs (`input`, ≥ 3:1, DESIGN.md § 2) ;
          // `p-px` + 1 px de bord gardent le bouton à la même place que `p-0.5` allumé.
          checked
            ? "bg-primary p-0.5"
            : "border border-input bg-pill-track p-px",
        )}
      >
        <span
          className={cn(
            "size-4 rounded-full bg-popover shadow-raised",
            checked && "translate-x-4",
          )}
        />
      </span>
    </motion.button>
  );
}
