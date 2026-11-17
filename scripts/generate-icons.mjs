// Génère les icônes de la PWA (DESIGN.md § 9) depuis docs/design/icon.svg, source unique :
// couleurs, rayon et position du glyphe viennent du SVG. Les variantes ne font que retirer
// l'arrondi, réduire le glyphe (zone sûre maskable) ou épaissir le trait (favicon).
// Rasterisation : Chromium de Playwright (déjà installé pour les e2e), aucune dépendance ajoutée.
// Régénérer : node scripts/generate-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const root = join(import.meta.dirname, "..");
const source = readFileSync(join(root, "docs/design/icon.svg"), "utf8");

// square : coins carrés (maskable ; iOS arrondit lui-même) ;
// glyphShare : largeur de la grille 24 × 24 du glyphe en part du côté (défaut : celle du SVG) ;
// stroke : épaisseur du trait du glyphe (défaut : celle du SVG).
const variants = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  // Zone sûre maskable : cercle de 80 % du côté ; le glyphe tient dans 40 %.
  {
    file: "public/icons/icon-maskable-512.png",
    size: 512,
    square: true,
    glyphShare: 0.4,
  },
  // iOS arrondit lui-même et refuse la transparence.
  { file: "public/icons/apple-touch-icon.png", size: 180, square: true },
  { file: "src/app/favicon.ico", size: 32, stroke: 2.4, ico: true },
];

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
      `<html><body style="margin:0;background:transparent">${source}</body></html>`,
    );
    await page.evaluate(({ size, square, glyphShare, stroke }) => {
      const svg = document.querySelector("svg");
      const side = svg.viewBox.baseVal.width;
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      if (square) svg.querySelector("rect").setAttribute("rx", "0");
      // Premier <g> : le groupe qui place et dimensionne le glyphe.
      const group = svg.querySelector("g");
      if (glyphShare !== undefined) {
        const scale = (side * glyphShare) / 24;
        const offset = (side - 24 * scale) / 2;
        group.setAttribute(
          "transform",
          `translate(${offset} ${offset}) scale(${scale})`,
        );
      }
      if (stroke !== undefined) {
        group.setAttribute("stroke-width", String(stroke));
      }
    }, variant);
    const png = await page.locator("svg").screenshot({ omitBackground: true });
    writeFileSync(
      join(root, variant.file),
      variant.ico ? icoFromPng(png, variant.size) : png,
    );
  }
} finally {
  await browser.close();
}
