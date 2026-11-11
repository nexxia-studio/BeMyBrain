// Curseurs nexxia-design : VARIANCE, MOTION, DENSITY fixés avec DESIGN.md (tâche 12).
// raccourci: page provisoire réduite au nom de l'app — remplacée par le tableau de bord (tâche 15).
import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("app");

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <h1>{t("name")}</h1>
    </main>
  );
}
