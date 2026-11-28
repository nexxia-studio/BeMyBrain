// `/lists` s'ouvre sur Courses (spec listes, Q3) ; Wishlist et Bucket List arrivent en PR C.
// Session vérifiée ici aussi (frontend.md : chaque page de `(app)` appelle `requireSession`).
import { redirect } from "next/navigation";

import { LISTS_PATH } from "@/components/shell/nav-items";
import { requireSession } from "@/lib/session";

export default async function ListsPage() {
  await requireSession();
  redirect(`${LISTS_PATH}/shopping`);
}
