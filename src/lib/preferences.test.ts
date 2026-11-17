// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  contextsCookie,
  parseContextSelection,
  parseSide,
  serializeContextSelection,
  SIDE_COOKIE,
} from "./preferences";

const TRUSTUP = "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";
const NEXXIA = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const PRO_CONTEXTS = [TRUSTUP, NEXXIA];

describe("préférences d'affichage (cookies)", () => {
  it("nomme le cookie du côté bmb_side", () => {
    expect(SIDE_COOKIE).toBe("bmb_side");
  });

  it("mémorise le filtre d'espace dans un cookie par côté", () => {
    const names = [contextsCookie("private"), contextsCookie("pro")];

    expect(names).toEqual(["bmb_contexts_private", "bmb_contexts_pro"]);
  });

  it("une valeur de cookie inconnue retombe sur Privé", () => {
    const side = parseSide("perso");

    expect(side).toBe("private");
  });

  it("un cookie absent retombe sur Privé", () => {
    expect(parseSide(undefined)).toBe("private");
  });

  it("lit le côté Pro enregistré", () => {
    expect(parseSide("pro")).toBe("pro");
  });

  it("garde le contexte choisi quand il appartient au workspace", () => {
    const selection = parseContextSelection(NEXXIA, PRO_CONTEXTS);

    expect(selection).toEqual([NEXXIA]);
  });

  it("sans cookie, sélectionne tous les contextes du côté", () => {
    expect(parseContextSelection(undefined, PRO_CONTEXTS)).toEqual(
      PRO_CONTEXTS,
    );
  });

  it("ignore un identifiant étranger au workspace ou mal formé et retombe sur tous", () => {
    const foreign = "11111111-2222-4333-8444-555555555555";

    const selection = parseContextSelection(
      `${foreign},pas-un-uuid`,
      PRO_CONTEXTS,
    );

    expect(selection).toEqual(PRO_CONTEXTS);
  });

  it("rend la sélection dans l'ordre des contextes, sans doublon", () => {
    const selection = parseContextSelection(
      `${NEXXIA},${TRUSTUP},${NEXXIA}`,
      PRO_CONTEXTS,
    );

    expect(selection).toEqual(PRO_CONTEXTS);
  });

  it("sérialise une sélection valide et refuse une valeur mal formée", () => {
    expect(serializeContextSelection([TRUSTUP, NEXXIA])).toBe(
      `${TRUSTUP},${NEXXIA}`,
    );
    expect(serializeContextSelection(["<script>"])).toBeNull();
  });
});
