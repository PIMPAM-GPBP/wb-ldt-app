#!/usr/bin/env node
// Phase 2 of docs/roadmap/LDT-UI-Overhaul-Plan.md: rewrites ad hoc radii, custom shadows, translucent
// white panels, gradient washes, and hover lifts in src/ to the design tokens in globals.css.
// src/components/ui is restyled by hand and skipped. Running it twice changes nothing.
//
// Usage: node scripts/codemods/phase-2-surfaces.mjs [--check]
//   --check  report what would change and exit 1 if anything would, without writing files.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set([path.join("src", "components", "ui")]);
const REMOVE = "\u0000";

// A utility class token: optional variants (hover:, md:, dark:, group-hover:) then the utility.
const START = String.raw`(?<![\w:/\[\]().-])`;
const END = String.raw`(?![\w/\[\]().-])`;

const rules = [
  {
    name: "radius",
    // 1rem and up were cards and panels: the 6px panel radius. Smaller ones were controls: 4px.
    pattern: new RegExp(`${START}((?:[\\w-]+:)*)rounded(-[trbl]{1,2})?-\\[(\\d*\\.?\\d+)rem\\]${END}`, "g"),
    replace: (_match, variants, side = "", rem) => `${variants}rounded${side}-${Number(rem) >= 1 ? "xl" : "lg"}`,
  },
  {
    name: "shadow",
    // One shadow remains, for floating things. Hairline rules drawn as shadows stay as they are.
    pattern: new RegExp(`${START}((?:[\\w-]+:)*)shadow-(\\[[^\\]\\s]+\\]|sm|md|lg|xl|2xl)${END}`, "g"),
    replace: (match, variants, value, file) => {
      if (value.startsWith("[0_1px_0_") || value.startsWith("[var(")) return match;
      if (value === "[0_18px_50px_rgba(2,20,32,0.28)]") return `${variants}shadow-float`;
      if (!value.startsWith("[")) return `${variants}shadow-float`;
      if (file.endsWith(path.join("layout", "app-header.tsx"))) return `${variants}shadow-float`;
      return REMOVE;
    },
  },
  {
    name: "bg-white",
    // Opaque surface tokens with dark values replace translucent white and its !important overrides.
    pattern: new RegExp(`${START}((?:[\\w-]+:)*)bg-white(\\/(?:\\d+|\\[[^\\]]+\\]))?${END}`, "g"),
    replace: (_match, variants, opacity) => {
      if (variants.split(":").includes("dark")) return REMOVE;
      return `${variants}bg-[var(${opacity ? "--surface" : "--surface-strong"})]`;
    },
  },
  {
    name: "gradient",
    // Decorative washes become flat surfaces. Data ramps (legend gradients) are left alone.
    pattern: new RegExp(`${START}((?:[\\w-]+:)*)bg-\\[(?:radial|linear)-gradient\\([^\\]\\s]*\\]${END}`, "g"),
    replace: (match, variants) => {
      if (match.includes("--panel-gradient") || match.includes("var(--surface-strong)")) {
        return `${variants}bg-[var(--surface-strong)]`;
      }
      // Hero washes go entirely: the page background is the hero background.
      if (match.includes("--hero-")) return REMOVE;
      if (match.includes("rgba(255,255,255,0.72)")) return `${variants}bg-[var(--surface-muted)]`;
      return match;
    },
  },
  {
    name: "pill",
    // A fully rounded element with padding is a pill chip or button: 4px like other controls.
    // Dots, rings, and avatars have no padding and keep rounded-full.
    pattern: /"([^"\n]*\brounded-full\b[^"\n]*)"/g,
    replace: (match, classes) =>
      /(?<![\w-])p[xy]-/.test(classes) ? `"${classes.replace(/\brounded-full\b/g, "rounded-md")}"` : match,
  },
  {
    name: "hover-lift",
    pattern: new RegExp(`${START}((?:[\\w-]+:)*)-translate-y-[\\d.]+${END}`, "g"),
    replace: (match, variants) => (/(^|-)hover:/.test(variants) ? REMOVE : match),
  },
];

function removeMarkers(source) {
  return source.replace(/[ \t]+\u0000/g, "").replace(/\u0000[ \t]+/g, "").replaceAll(REMOVE, "");
}

async function listFiles(dir) {
  if (SKIP_DIRS.has(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(full);
      return /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
    }),
  );
  return nested.flat();
}

const check = process.argv.includes("--check");
const counts = Object.fromEntries(rules.map((rule) => [rule.name, 0]));
const changedFiles = [];

for (const file of await listFiles("src")) {
  const original = await readFile(file, "utf8");
  let next = original;
  for (const rule of rules) {
    next = next.replace(rule.pattern, (...args) => {
      const groups = args.slice(0, -2);
      const result = rule.replace(...groups, file);
      if (result !== groups[0]) counts[rule.name] += 1;
      return result;
    });
  }
  next = removeMarkers(next);
  if (next !== original) {
    changedFiles.push(file);
    if (!check) await writeFile(file, next);
  }
}

for (const [name, count] of Object.entries(counts)) console.log(`${name}: ${count}`);
console.log(`${check ? "would change" : "changed"} ${changedFiles.length} files`);
for (const file of changedFiles) console.log(`  ${file}`);
if (check && changedFiles.length > 0) process.exit(1);
