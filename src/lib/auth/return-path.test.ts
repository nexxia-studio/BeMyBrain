// @vitest-environment node
import { describe, expect, it } from "vitest";

import { appOrigin, returnPath } from "./return-path";

const APP = "https://bemybrain.test";

describe("chemin de retour après connexion", () => {
  it("garde un chemin interne simple", () => {
    const path = returnPath("/settings", APP);

    expect(path).toBe("/settings");
  });

  it("garde le chemin d'une URL complète de l'app (en-tête Referer)", () => {
    const path = returnPath(`${APP}/settings`, APP);

    expect(path).toBe("/settings");
  });

  it("ne garde que le chemin : ni paramètres d'URL ni fragment", () => {
    const path = returnPath("/settings?x=1#y", APP);

    expect(path).toBe("/settings");
  });

  it("ignore les barres encodées des paramètres d'URL, jetés de toute façon", () => {
    const path = returnPath(`${APP}/settings?retour=%2Fdashboard`, APP);

    expect(path).toBe("/settings");
  });

  it.each([
    ["//evil.test", "URL sans schéma"],
    ["//evil.test/settings", "URL sans schéma avec chemin"],
    ["/\\evil.test", "barre oblique inverse après la barre"],
    ["\\\\evil", "deux barres obliques inverses"],
    ["/settings\\x", "barre oblique inverse dans le chemin"],
    ["https://autre.test/x", "URL complète d'une autre origine"],
    ["https://autre.test/settings", "même chemin, autre origine"],
    ["http://bemybrain.test/settings", "même hôte, autre schéma"],
    ["https://bemybrain.test:8443/settings", "même hôte, autre port"],
    ["settings", "chemin non relatif à la racine"],
    ["javascript:alert(1)", "schéma javascript"],
    ["/\t/evil.test", "tabulation retirée par l'analyseur d'URL"],
    ["/\n/evil.test", "saut de ligne retiré par l'analyseur d'URL"],
    [" /settings", "espace en tête"],
    ["/login", "la page de connexion elle-même"],
    ["/login/", "la page de connexion avec barre finale"],
    [`${APP}/login?next=/settings`, "la page de connexion en URL complète"],
    ["", "valeur vide"],
    ["/%2Fevil.test", "barre oblique encodée (%2F)"],
    ["/%2fevil.test", "barre oblique encodée en minuscules (%2f)"],
    ["/settings%2F..%2Flogin", "barre oblique encodée dans le chemin"],
    ["/%5Cevil.test", "barre oblique inverse encodée (%5C)"],
    ["/%5cevil.test", "barre oblique inverse encodée en minuscules (%5c)"],
    [`${APP}/%2F%2Fevil.test`, "barres encodées dans une URL complète"],
  ])("refuse %j (%s)", (value) => {
    const path = returnPath(value, APP);

    expect(path).toBeNull();
  });

  it.each([
    [null, APP],
    [undefined, APP],
    ["/settings", null],
  ])("refuse sans valeur ou sans origine connue (%j, %j)", (value, origin) => {
    const path = returnPath(value, origin);

    expect(path).toBeNull();
  });
});

describe("origine de l'app", () => {
  function headers(values: Record<string, string>) {
    return new Headers(values);
  }

  it("se déduit de l'hôte et du schéma transmis par la plateforme", () => {
    const origin = appOrigin(
      headers({ host: "bemybrain.test", "x-forwarded-proto": "https" }),
    );

    expect(origin).toBe("https://bemybrain.test");
  });

  it("préfère l'hôte transmis par le proxy de la plateforme, comme la garde CSRF de Next", () => {
    const origin = appOrigin(
      headers({
        host: "interne:3000",
        "x-forwarded-host": "bemybrain.test",
        "x-forwarded-proto": "https",
      }),
    );

    expect(origin).toBe("https://bemybrain.test");
  });

  it("garde le port de l'hôte (développement local)", () => {
    const origin = appOrigin(
      headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
    );

    expect(origin).toBe("http://localhost:3000");
  });

  it("retire le port par défaut, comme URL.origin", () => {
    const origin = appOrigin(
      headers({ host: "bemybrain.test:443", "x-forwarded-proto": "https" }),
    );

    expect(origin).toBe("https://bemybrain.test");
  });

  it.each([
    [
      { host: "bemybrain.test:99999", "x-forwarded-proto": "https" },
      "port invalide",
    ],
    [{ "x-forwarded-proto": "https" }, "sans hôte"],
    [{ host: "bemybrain.test" }, "sans schéma"],
    [{ host: "bemybrain.test", "x-forwarded-proto": "ftp" }, "schéma inconnu"],
    [
      { host: "evil.test/x", "x-forwarded-proto": "https" },
      "hôte qui contient un chemin",
    ],
    [
      { host: "user@evil.test", "x-forwarded-proto": "https" },
      "hôte qui contient des identifiants",
    ],
  ] as [Record<string, string>, string][])("est inconnue %j (%s)", (values) => {
    const origin = appOrigin(headers(values));

    expect(origin).toBeNull();
  });
});
