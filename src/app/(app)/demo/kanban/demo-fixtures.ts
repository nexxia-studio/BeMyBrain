// Tâches fictives de la démo du kanban (BRAIN-46), en mémoire : aucune base. Titres, espaces et tags jouent le
// rôle du contenu saisi : jamais traduits (ADR-007), comme dans la vraie liste. Noms d'espaces, de clients
// et de personnes fictifs : dépôt public. Échéances relatives au jour
// donné par la page (`today`, fuseau de l'utilisateur) : en retard, aujourd'hui, plus tard.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import type { ContextColor } from "@/modules/core/context-colors";

import { DEMO_STATUSES, type DemoBoard, type DemoStatus } from "./demo-board";

export type DemoTask = {
  id: string;
  title: string;
  status: DemoStatus;
  contextName: string | null;
  contextColor: ContextColor;
  tags: readonly string[];
  /** 0 aucune, 1 urgente … 4 basse (ordre Linear, comme les tâches). */
  priority: number;
  /** `YYYY-MM-DD` ou `null`. */
  dueDate: string | null;
  blocked: boolean;
  /** Contenu saisi : jamais traduit. */
  notes: string | null;
  /** `HH:MM` ou `null` (pastille Échéance du détail). */
  dueTime: string | null;
  subtasks: readonly DemoSubtask[];
};

export type DemoSubtask = { id: string; title: string; done: boolean };

type Space = [name: string, color: ContextColor] | null;
const HOME: Space = ["Maison", "neutral"];
const CLIENT: Space = ["Orme Conseil", "warm"];
const STUDIO: Space = ["Studio", "indigo"];

// [titre, espace, tags, priorité, échéance en jours depuis aujourd'hui (null : aucune), bloquée]
type Row = [string, Space, string[], number, number | null, boolean?];

const ROWS: Record<DemoStatus, Row[]> = {
  backlog: [
    ["Repenser l'onboarding des abonnés", STUDIO, ["produit"], 3, null],
    ["Devis pour la toiture", HOME, [], 4, 21],
    [
      "Lire le rapport annuel du fonds de pension avant la réunion de janvier",
      null,
      ["finances"],
      0,
      null,
    ],
    ["Trier le garage", HOME, [], 0, null],
    ["Atelier de cadrage Orme Conseil Q1", CLIENT, ["client"], 2, 14],
  ],
  unstarted: [
    ["Rappeler le plombier", HOME, [], 1, -2, true],
    [
      "Envoyer la facture de novembre à Orme Conseil",
      CLIENT,
      ["admin", "client"],
      2,
      -1,
    ],
    [
      "Préparer la démo du kanban et noter les retours au doigt sur le téléphone",
      STUDIO,
      ["produit"],
      2,
      0,
    ],
    ["Courses de la semaine", HOME, ["courses"], 3, 0],
    ["Prendre rendez-vous chez le dentiste", null, ["santé"], 3, 1],
    ["Relire le contrat de maintenance", CLIENT, ["client"], 2, 2, true],
    ["Renouveler l'assurance auto", HOME, ["admin"], 2, 3],
    ["Mettre à jour les mentions légales du site", STUDIO, [], 4, 5],
    ["Commander les pneus hiver", HOME, [], 3, 6],
    ["Réserver le train pour Paris", null, [], 0, 7],
    [
      "Écrire l'article sur la migration vers Neon et la sécurité des branches de preview",
      STUDIO,
      ["blog"],
      3,
      10,
    ],
    ["Payer la taxe communale", HOME, ["admin", "finances"], 1, 12],
    ["Faire le point avec le comptable", STUDIO, ["finances"], 2, 14, true],
    ["Changer le filtre de la hotte", HOME, [], 4, null],
    ["Appeler le syndic", null, [], 0, null],
  ],
  started: [
    ["Refonte de la page tarifs", STUDIO, ["produit"], 2, 2],
    [
      "Migration des données d'Orme Conseil vers le nouvel entrepôt, avec reprise des historiques",
      CLIENT,
      ["client"],
      1,
      -3,
      true,
    ],
    ["Déclaration d'impôts", null, ["admin", "finances"], 1, 0],
    ["Peindre la chambre", HOME, [], 4, null],
  ],
  // Plus récentes d'abord.
  completed: [
    "Valider le budget de décembre",
    "Rendre les livres à la bibliothèque",
    "Mettre à jour Next.js",
    "Envoyer le compte rendu à Orme Conseil",
    "Vidange de la voiture",
    "Répondre au notaire",
    "Corriger le bug du filtre d'espace",
    "Acheter le cadeau d'anniversaire",
    "Résilier l'ancien abonnement mobile",
    "Préparer la réunion d'équipe",
    "Faire réviser la chaudière",
    "Publier la newsletter de novembre",
    "Ranger la cave",
    "Payer la facture d'électricité",
    "Tester la sauvegarde de production",
    "Réserver le restaurant",
    "Mettre à jour le CV",
    "Envoyer les photos de vacances",
    "Changer le mot de passe du routeur",
    "Inscrire les enfants au stage",
    "Relancer le client pour le paiement en retard",
    "Remplacer l'ampoule du couloir",
    "Faire le plein",
    "Archiver les factures 2025",
  ].map((title, index): Row => [
    title,
    [HOME, STUDIO, CLIENT, null][index % 4],
    index % 5 === 0 ? ["admin"] : [],
    index % 3 === 0 ? 3 : 0,
    -1 - index,
  ]),
  canceled: [
    ["Salon de l'auto", null, [], 0, -10],
    ["Migrer vers Supabase", STUDIO, [], 3, null],
    ["Repeindre la clôture", HOME, [], 4, null],
  ],
};

// Notes et sous-tâches de quelques cartes, par id (`<statut>-<rang>`) : [notes, [titre, faite]…].
const DETAILS: Record<string, [string | null, [string, boolean][]]> = {
  "unstarted-1": [
    "Fuite sous l'évier de la cuisine. Demander un passage avant vendredi.",
    [],
  ],
  "unstarted-3": [
    "Tap court : le détail. Appui long : la carte se soulève.",
    [
      ["Essai sur iPhone", true],
      ["Essai sur ordinateur", false],
      ["Noter les retours", false],
    ],
  ],
  "started-1": [
    null,
    [
      ["Grille des formules", true],
      ["Textes FR et EN", false],
    ],
  ],
  "started-3": [
    "Pièces justificatives dans le dossier « Impôts 2026 ».",
    [
      ["Rassembler les attestations", true],
      ["Remplir la déclaration en ligne", false],
    ],
  ],
};

const DAY_MS = 86_400_000;

/** Jour `YYYY-MM-DD` décalé de `days`, calculé en UTC (aucun fuseau de la machine). */
function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function demoTasks(today: string): DemoTask[] {
  return DEMO_STATUSES.flatMap((status) =>
    ROWS[status].map(([title, space, tags, priority, due, blocked], index) => {
      const id = `${status}-${index + 1}`;
      const [notes, subtasks] = DETAILS[id] ?? [null, []];
      return {
        id,
        title,
        status,
        contextName: space?.[0] ?? null,
        contextColor: space?.[1] ?? "neutral",
        tags,
        priority,
        dueDate: due === null ? null : addDays(today, due),
        blocked: blocked ?? false,
        notes,
        dueTime: null,
        subtasks: subtasks.map(([subtaskTitle, done], rank) => ({
          id: `${id}.${rank + 1}`,
          title: subtaskTitle,
          done,
        })),
      };
    }),
  );
}

/** Tableau de départ : chaque colonne dans l'ordre des tâches fictives. */
export function demoBoard(tasks: readonly DemoTask[]): DemoBoard {
  return Object.fromEntries(
    DEMO_STATUSES.map((status) => [
      status,
      tasks.filter((task) => task.status === status).map((task) => task.id),
    ]),
  ) as Record<DemoStatus, string[]>;
}
