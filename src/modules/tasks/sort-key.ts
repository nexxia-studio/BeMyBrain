/**
 * Clés d'ordre fractionnaires de `tasks.sort_key` (`text COLLATE "C"`, comparées octet par octet).
 *
 * Une clé se lit comme une fraction en base 62 (« 0,<clé> ») : il existe donc toujours une clé entre deux
 * clés distinctes, sans réécrire les autres lignes. Une clé valide n'est jamais vide et ne finit jamais par
 * « 0 » (le plus petit caractère), sinon rien ne pourrait plus s'insérer juste avant elle.
 *
 * - Entre deux voisines : milieu de l'intervalle, au plus court.
 * - En tête ou en queue (le cas courant : une tâche arrive en tête de colonne) : pas d'une unité sur un
 *   préfixe de longueur fixe par classe. La classe c (c « 0 » en tête ou c « z » en queue, puis c + 1
 *   chiffres) contient environ 62^(c + 1) clés de 2c + 1 caractères : la longueur croît comme le
 *   logarithme du nombre d'insertions, pas comme leur nombre.
 *
 * Fonctions pures. Erreurs en phrases fixes, jamais la valeur reçue (`.claude/rules/sentry.md`).
 */

/** Ordre ASCII strictement croissant : l'ordre des chaînes en JavaScript (`<`) est celui de la colonne. */
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
const MIN = DIGITS.charAt(0);
const MAX = DIGITS.charAt(BASE - 1);
const VALID_KEY = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

const INVALID_KEY_MESSAGE = "Invalid sort key.";
const INVALID_ORDER_MESSAGE = "Sort key neighbours are equal or reversed.";
const INVALID_COUNT_MESSAGE = "Invalid sort key count.";

/**
 * Plafond de `keysFor` : 50 fois le plafond de lecture d'une colonne du tableau (200 cartes, après filtre),
 * car l'ordre est global par workspace et par catégorie, tous côtés et espaces confondus. Au-delà : erreur,
 * plutôt qu'une réécriture sans borne. Clés de 4 caractères au plus à ce plafond.
 */
export const KEYS_FOR_MAX = 10_000;

/**
 * Longueur maximale d'une clé rangée. Même valeur que la contrainte `tasks_sort_key_check`
 * (drizzle/0010_tasks_order_and_parent_checks.sql) : un test compare les deux. Large : 200 insertions au
 * même endroit donnent 41 caractères au plus, `keysFor` 4 au plus.
 */
export const SORT_KEY_MAX_LENGTH = 64;

function assertKey(key: string): void {
  // `typeof` d'abord : `RegExp.test` convertirait en chaîne une valeur venue d'ailleurs (nombre, objet).
  if (
    typeof key !== "string" ||
    key.length > SORT_KEY_MAX_LENGTH ||
    !VALID_KEY.test(key)
  ) {
    throw new Error(INVALID_KEY_MESSAGE);
  }
}

function leadingCount(key: string, char: string): number {
  let count = 0;
  while (key.charAt(count) === char) count++;
  return count;
}

/** Ajoute `delta` (+1 ou -1) à un nombre de largeur fixe. L'appelant garantit qu'il ne déborde pas. */
function step(digits: string, delta: 1 | -1): string {
  const wrapped = delta === 1 ? MAX : MIN;
  let index = digits.length - 1;
  while (digits.charAt(index) === wrapped) index--;
  const moved = DIGITS.charAt(DIGITS.indexOf(digits.charAt(index)) + delta);
  const rest = (delta === 1 ? MIN : MAX).repeat(digits.length - 1 - index);
  return digits.slice(0, index) + moved + rest;
}

/** Préfixe de la clé à la largeur de sa classe (2c + 1), sans l'en-tête de c caractères. */
function classBody(key: string, classIndex: number): string {
  const width = 2 * classIndex + 1;
  return key.slice(0, width).padEnd(width, MIN).slice(classIndex);
}

/** Une clé juste avant `key` : un pas en arrière dans sa classe, ou la plus grande clé de la classe suivante. */
function keyBefore(key: string): string {
  const classIndex = leadingCount(key, MIN);
  const nextClass = MIN.repeat(classIndex + 1) + MAX.repeat(classIndex + 2);
  // Le corps commence par un caractère non nul : il vaut au moins 1, le pas en arrière ne déborde pas.
  let body = step(classBody(key, classIndex), -1);
  if (body.startsWith(MIN)) return nextClass;
  if (body.endsWith(MIN)) {
    body = step(body, -1);
    if (body.startsWith(MIN)) return nextClass;
  }
  return MIN.repeat(classIndex) + body;
}

/** Une clé juste après `key` : un pas en avant dans sa classe, ou la plus petite clé de la classe suivante. */
function keyAfter(key: string): string {
  const classIndex = leadingCount(key, MAX);
  // Le corps ne commence pas par « z » : le pas en avant ne déborde pas.
  let body = step(classBody(key, classIndex), 1);
  if (body.startsWith(MAX)) {
    return (
      MAX.repeat(classIndex + 1) + MIN.repeat(classIndex + 1) + DIGITS.charAt(1)
    );
  }
  // Fin en « 0 » : seulement après une retenue, donc sur un corps d'au moins deux chiffres ; un pas de plus.
  if (body.endsWith(MIN)) body = step(body, 1);
  return MAX.repeat(classIndex) + body;
}

/** Milieu de l'intervalle ouvert (before, after) ; `after` null = borne haute (1). `before` peut être vide (0). */
function midpoint(before: string, after: string | null): string {
  if (after !== null) {
    let common = 0;
    while ((before.charAt(common) || MIN) === after.charAt(common)) common++;
    if (common > 0) {
      return (
        after.slice(0, common) +
        midpoint(before.slice(common), after.slice(common))
      );
    }
  }
  const low = before === "" ? 0 : DIGITS.indexOf(before.charAt(0));
  const high = after === null ? BASE : DIGITS.indexOf(after.charAt(0));
  if (high - low > 1) return DIGITS.charAt((low + high) >> 1);
  // Chiffres consécutifs : le premier chiffre de `after` seul est entre les deux, si `after` est plus long.
  if (after !== null && after.length > 1) return after.charAt(0);
  return DIGITS.charAt(low) + midpoint(before.slice(1), null);
}

/**
 * Clé strictement entre deux voisines. `null` = pas de voisine de ce côté ; les deux `null` = première clé
 * d'une colonne vide.
 * Les voisines font `SORT_KEY_MAX_LENGTH` caractères au plus (sinon erreur), mais la clé rendue peut
 * dépasser cette borne : entre deux voisines adjacentes de cette longueur, la seule clé possible est plus
 * longue. C'est à l'appelant de comparer sa longueur à la borne et de remettre la colonne en ordre
 * (`keysFor`) avant de ranger quoi que ce soit (moveTask).
 */
export function keyBetween(
  before: string | null,
  after: string | null,
): string {
  if (before !== null) assertKey(before);
  if (after !== null) assertKey(after);
  if (before === null) {
    return after === null ? DIGITS.charAt(BASE >> 1) : keyBefore(after);
  }
  if (after === null) return keyAfter(before);
  if (before >= after) throw new Error(INVALID_ORDER_MESSAGE);
  return midpoint(before, after);
}

/**
 * `count` clés croissantes, régulièrement espacées, pour donner un ordre à toute une colonne d'un coup.
 * `count` au-delà de `KEYS_FOR_MAX` → erreur.
 */
export function keysFor(count: number): string[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > KEYS_FOR_MAX) {
    throw new Error(INVALID_COUNT_MESSAGE);
  }
  // Largeur : la plus petite qui laisse au moins 61 clés libres entre deux clés rendues.
  let width = 2;
  while (BASE ** (width - 1) < count + 1) width++;
  const gap = Math.floor(BASE ** width / (count + 1));
  return Array.from({ length: count }, (_, index) => {
    let value = (index + 1) * gap;
    let key = "";
    for (let i = 0; i < width; i++) {
      key = DIGITS.charAt(value % BASE) + key;
      value = Math.floor(value / BASE);
    }
    // Zéros de fin retirés : même fraction, même ordre, et la clé ne finit jamais par « 0 ».
    return key.replace(/0+$/, "");
  });
}
