// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Coque de l'app (DESIGN.md § 5–6, § 9). Repli : sous 1024 px, nom + pilule en haut et barre d'onglets
// flottante en bas (le contenu réserve sa hauteur) ; à partir de 1024 px, en-tête en verre + barre
// latérale + contenu, ≤ 1400 px centré. Côtés écartés des zones sûres iOS (paysage).
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ContextFilter } from "@/components/shell/ContextFilter";
import { MotionRoot } from "@/components/shell/MotionRoot";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { Sidebar } from "@/components/shell/Sidebar";
import { TabBar } from "@/components/shell/TabBar";
import { signOut } from "@/lib/auth/actions";
import { readContextSelection, readSide } from "@/lib/preferences";
import { requireSession, requireSessionToken } from "@/lib/session";
import { loadContexts } from "@/modules/core/contexts";

type ProFilter = {
  contexts: { id: string; name: string }[];
  selected: string[];
};

/** Filtre de contexte côté Pro : seulement s'il y a un choix à faire (au moins deux contextes). */
async function loadProFilter(workspaceId: string): Promise<ProFilter | null> {
  const contexts = await loadContexts(
    await requireSessionToken(),
    workspaceId,
    "pro",
  );
  if (contexts.length < 2) return null;
  const ids = contexts.map((context) => context.id);
  return {
    contexts: contexts.map(({ id, name }) => ({ id, name })),
    selected: await readContextSelection(ids),
  };
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Second verrou après le proxy. Pas suffisant seul (non réexécuté en navigation client, ignoré par
  // les Server Actions) : chaque page et chaque action non publique appelle aussi requireSession.
  const session = await requireSession();
  const side = await readSide();
  const proFilter =
    side === "pro" ? await loadProFilter(session.workspaceId) : null;

  const signOutForm = (
    <form action={signOut}>
      <SignOutButton />
    </form>
  );

  return (
    <MotionRoot>
      <div className="flex min-h-dvh flex-col pr-safe-right pl-safe-left">
        <div className="mx-auto flex w-full max-w-content flex-1 flex-col gap-grid px-page pt-page-top pb-tabbar-reserve lg:pb-page">
          <ShellHeader side={side} />
          <div className="flex flex-1 items-start gap-grid">
            <Sidebar
              side={side}
              footer={signOutForm}
              className="hidden lg:flex"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-grid">
              {proFilter ? (
                <ContextFilter
                  contexts={proFilter.contexts}
                  selected={proFilter.selected}
                />
              ) : null}
              {children}
              {/* raccourci: déconnexion en bas de page sur mobile — elle ira dans l'onglet Réglages (tâche 16). */}
              <div className="lg:hidden">{signOutForm}</div>
            </div>
          </div>
        </div>
        <TabBar className="lg:hidden" />
      </div>
    </MotionRoot>
  );
}
