import { redirect } from "next/navigation";

import { HOME_PATH } from "@/lib/auth/routes";

// raccourci: page provisoire — l'accueil de l'app est le tableau de bord (protégé par requireSession).
export default function Home() {
  redirect(HOME_PATH);
}
