import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import DetailLoading from "./loading";

const TASKS_DIR = join(process.cwd(), "src/app/(app)/tasks");

describe("chargement du détail ouvert par son adresse (emplacement @detail)", () => {
  it("rien : ni titre ni givre de la liste, que le chargement de la liste affiche déjà", () => {
    const element = DetailLoading();

    expect(element).toBeNull();
  });

  it("le chargement de la liste vit dans le groupe (list) : il n'enveloppe pas l'emplacement @detail", () => {
    // Next 16 pose le `loading.tsx` d'un dossier autour de chaque emplacement de son layout (BRAIN-54).
    const atTasksLevel = existsSync(join(TASKS_DIR, "loading.tsx"));
    const inListGroup = existsSync(join(TASKS_DIR, "(list)/loading.tsx"));

    expect(atTasksLevel).toBe(false);
    expect(inListGroup).toBe(true);
  });
});
