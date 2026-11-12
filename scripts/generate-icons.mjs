// Génère les icônes de la PWA (DESIGN.md § 9) depuis docs/design/icon.svg.
// Rasterisation : Chromium de Playwright (déjà installé pour les e2e), aucune dépendance ajoutée.
// Régénérer : node scripts/generate-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const root = join(import.meta.dirname, "..");
const source = readFileSync(join(root, "docs/design/icon.svg"), "utf8");
const glyph = source.match(/<g id="glyph">([\s\S]*?)<\/g>/)?.[1];
if (!glyph) throw new Error('docs/design/icon.svg : groupe id="glyph" introuvable.');

const INDIGO = "#3D4FD6";
const WHITE = "#FFFFFF";

// radius : rayon des coins en part du côté ; glyph : largeur de la grille 24 × 24 en part du côté.
const variants = [
  { file: "public/icons/icon-192.png", size: 192, radius: 0.35, glyph: 0.5, stroke: 2 },
  { file: "public/icons/icon-512.png", size: 512, radius: 0.35, glyph: 0.5, stroke: 2 },
  // Zone sûre maskable : cercle de 80 % du côté ; le glyphe tient dans 40 %.
  { file: "public/icons/icon-maskable-512.png", size: 512, radius: 0, glyph: 0.4, stroke: 2 },
  // iOS arrondit lui-même et refuse la transparence.
  { file: "public/icons/apple-touch-icon.png", size: 180, radius: 0, glyph: 0.5, stroke: 2 },
  { file: "favicon-32.png", size: 32, radius: 0.35, glyph: 0.5, stroke: 2.4 },
];

function svg({ size, radius, glyph: share, stroke }) {
  const scale = (size * share) / 24;
  const offset = (size - size * share) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${INDIGO}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${WHITE}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;
}

// ICO à une image PNG embarquée (format admis par tous les navigateurs actuels).
function icoFromPng(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const variant of variants) {
    await page.setViewportSize({ width: variant.size, height: variant.size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg(variant)}</body></html>`,
    );
    const png = await page.locator("svg").screenshot({ omitBackground: true });
    if (variant.file === "favicon-32.png") {
      writeFileSync(join(root, "src/app/favicon.ico"), icoFromPng(png, variant.size));
    } else {
      writeFileSync(join(root, variant.file), png);
    }
  }
} finally {
  await browser.close();
}
