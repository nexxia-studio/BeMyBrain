import { SignOutButton } from "@/components/auth/SignOutButton";
import { signOut } from "@/lib/auth/actions";
import { requireSession } from "@/lib/session";

// raccourci: coque réduite au bouton de déconnexion — navigation et bascule Privé / Pro à la tâche 14.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Second verrou après le proxy. Pas suffisant seul (non réexécuté en navigation client, ignoré par
  // les Server Actions) : chaque page et chaque action non publique appelle aussi requireSession.
  await requireSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-end px-4 py-2">
        <form action={signOut}>
          <SignOutButton />
        </form>
      </header>
      {children}
    </div>
  );
}
