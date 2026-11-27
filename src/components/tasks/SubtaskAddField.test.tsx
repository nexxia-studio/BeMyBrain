import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Profiler } from "react";
import { describe, expect, it, vi } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";
import { TASK_TITLE_MAX } from "@/modules/tasks/sides";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { SubtaskAddField } from "./SubtaskAddField";

type OnAdd = (title: string) => Promise<string | null>;

function renderField(
  onAdd: OnAdd,
  locale: "fr" | "en" = "fr",
  onCommit: () => void = () => {},
) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone={getUserTimeZone()}
    >
      {/* `onRender` est appelé à chaque rendu appliqué au DOM : de quoi relever les états intermédiaires. */}
      <Profiler id="field" onRender={onCommit}>
        <SubtaskAddField onAdd={onAdd} />
      </Profiler>
    </NextIntlClientProvider>,
  );
  return screen.getByRole("textbox", {
    name: (locale === "fr" ? fr : en).tasks.detail.subtasks.add,
  }) as HTMLInputElement;
}

/** Saisie puis Entrée (envoi du formulaire), le champ ayant le focus comme à l'écran. */
function typeAndEnter(field: HTMLInputElement, value: string) {
  field.focus();
  fireEvent.change(field, { target: { value } });
  fireEvent.submit(field.closest("form") as HTMLFormElement);
}

describe("SubtaskAddField", () => {
  it("Entrée ajoute : titre transmis, champ vidé, focus gardé pour la suivante", async () => {
    const onAdd = vi.fn<OnAdd>(async () => null);
    const field = renderField(onAdd);

    typeAndEnter(field, "Préparer le devis");

    await waitFor(() => expect(field.value).toBe(""));
    expect(onAdd).toHaveBeenCalledExactlyOnceWith("Préparer le devis");
    expect(document.activeElement).toBe(field);
    expect(field.readOnly).toBe(false);

    typeAndEnter(field, "Envoyer le devis");
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
    expect(onAdd).toHaveBeenLastCalledWith("Envoyer le devis");
  });

  it("une ligne à venir : icône « + » décorative, texte d'invite, clavier « Terminé », police sans zoom iOS", () => {
    const field = renderField(async () => null);

    expect(field.placeholder).toBe(fr.tasks.detail.subtasks.add);
    expect(field.getAttribute("enterkeyhint")).toBe("done");
    expect(field.classList.contains("text-base")).toBe(true);
    const icon = field.closest("form")!.querySelector("svg")!;
    expect(icon.classList.contains("lucide-plus")).toBe(true);
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    // Zone tactile : la ligne entière fait 44 px au moins et porte le champ.
    expect(field.closest("label")!.classList.contains("min-h-11")).toBe(true);
  });

  it("titre vide ou espaces : rien", () => {
    const onAdd = vi.fn<OnAdd>(async () => null);
    const field = renderField(onAdd);

    typeAndEnter(field, "");
    typeAndEnter(field, "   ");

    expect(onAdd).not.toHaveBeenCalled();
    expect(field.value).toBe("   ");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("pendant l'appel : lecture seule sans perdre le focus, une seconde Entrée ne renvoie rien", async () => {
    let finish!: (error: string | null) => void;
    const onAdd = vi.fn<OnAdd>(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const field = renderField(onAdd);

    typeAndEnter(field, "Préparer le devis");

    await waitFor(() => expect(field.readOnly).toBe(true));
    expect(field.disabled).toBe(false);
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe("Préparer le devis");
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(onAdd).toHaveBeenCalledTimes(1);

    await act(async () => finish(null));
    await waitFor(() => expect(field.readOnly).toBe(false));
    expect(field.value).toBe("");
    expect(document.activeElement).toBe(field);
  });

  it("échec : message sous le champ relié au champ, saisie et focus gardés, effacé à l'essai suivant", async () => {
    const onAdd = vi
      .fn<OnAdd>()
      .mockResolvedValueOnce("Sous-tâche non ajoutée. Réessaie.")
      .mockResolvedValueOnce(null);
    const field = renderField(onAdd);

    typeAndEnter(field, "Préparer le devis");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Sous-tâche non ajoutée. Réessaie.");
    expect(field.getAttribute("aria-describedby")).toBe(alert.id);
    expect(field.value).toBe("Préparer le devis");
    expect(document.activeElement).toBe(field);

    fireEvent.submit(field.closest("form") as HTMLFormElement);

    await waitFor(() => expect(field.value).toBe(""));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(field.hasAttribute("aria-describedby")).toBe(false);
  });

  it("succès : aucun rendu ne montre le champ vidé mais encore en lecture seule", async () => {
    let finish!: (error: string | null) => void;
    const onAdd = vi.fn<OnAdd>(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const commits: { value: string; readOnly: boolean }[] = [];
    const field = renderField(onAdd, "fr", () => {
      // Premier rendu : appelé avant que `renderField` ait rendu le champ.
      const input = document.querySelector("input");
      if (input !== null) {
        commits.push({ value: input.value, readOnly: input.readOnly });
      }
    });
    typeAndEnter(field, "Préparer le devis");
    await waitFor(() => expect(field.readOnly).toBe(true));

    await act(async () => finish(null));
    await waitFor(() => expect(field.readOnly).toBe(false));

    expect(field.value).toBe("");
    expect(commits).not.toContainEqual({ value: "", readOnly: true });
    // Témoin : le relevé voit bien les rendus (lecture seule avec la saisie, puis vidé et modifiable).
    expect(commits).toContainEqual({
      value: "Préparer le devis",
      readOnly: true,
    });
    expect(commits.at(-1)).toEqual({ value: "", readOnly: false });
  });

  it("au repos, la ligne n'est pas estompée : l'estompage ne vise que le champ en lecture seule", () => {
    const field = renderField(async () => null);

    const row = field.closest("label")!;

    // `has-read-only:` compile en `:has(:read-only)`, vrai pour tout élément non modifiable (`span`, `svg`).
    expect(row.classList.contains("has-read-only:opacity-60")).toBe(false);
    expect(row.classList.contains("has-[input:read-only]:opacity-60")).toBe(
      true,
    );
  });

  it("limite la saisie à la longueur maximale d'un titre", () => {
    const field = renderField(async () => null);

    expect(field.maxLength).toBe(TASK_TITLE_MAX);
  });

  it("en anglais : nom accessible et texte d'invite traduits", () => {
    const field = renderField(async () => null, "en");

    expect(field.placeholder).toBe("Add a subtask");
  });
});
