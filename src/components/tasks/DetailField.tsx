// Ligne de champ du détail (Statut, Priorité, Côté et espace, Échéance, Tags) : libellé visible à gauche
// (`text-small`, encre secondaire sur `popover` blanc : 6,83:1), contrôles à droite, erreurs dessous en braise
// (`role="alert"`, ids reliés aux contrôles par `aria-describedby`). Le libellé passe sur deux lignes plutôt que
// d'être tronqué (FR plus long que EN) ; les pastilles passent à la ligne sous 390 px.

export type FieldError = {
  id: string;
  /** Texte déjà traduit. */ text: string;
};

type DetailFieldProps = {
  label: string;
  errors: FieldError[];
  children: React.ReactNode;
};

export function DetailField({ label, errors, children }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center gap-3">
        <span className="w-28 shrink-0 text-small text-muted-foreground">
          {label}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {children}
        </div>
      </div>
      {errors.map((error) => (
        <p
          key={error.id}
          id={error.id}
          role="alert"
          className="text-caption text-destructive pl-31"
        >
          {error.text}
        </p>
      ))}
    </div>
  );
}
