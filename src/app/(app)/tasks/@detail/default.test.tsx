import { describe, expect, it } from "vitest";

import DetailDefault from "./default";
import DetailOnList from "./page";

describe("emplacement du détail hors interception", () => {
  it("chargement complet : ne rend rien (liste seule, ou détail ouvert directement par son adresse)", () => {
    expect(DetailDefault()).toBeNull();
  });

  it("navigation vers la liste /tasks : ne rend rien, le détail intercepté se ferme", () => {
    expect(DetailOnList()).toBeNull();
  });
});
