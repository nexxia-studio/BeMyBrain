import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { signOut } from "@/lib/auth/actions";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { getSession } from "@/lib/auth/server";

// raccourci: coque réduite au bouton de déconnexion — navigation et bascule Privé / Pro à la tâche 14.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Second verrou après le proxy : aucune page de (app) ne se rend sans session serveur.
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);

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
