#!/usr/bin/env node
/*
 * sync-offer.mjs — Self-improving offer -> legal/marketing sync engine.
 *
 * offer.json is the single source of truth. Every offer-derived value in the
 * pages is wrapped in a marker:
 *
 *     <!--OFFER:key-->rendered value<!--/OFFER:key-->
 *
 * where `key` is a dot-path into offer.json, e.g. `entity`, `doorsClose`,
 * `tiers.0.price`, `coaching.sixWeek.price`, `coaching.sixWeek.spots`.
 *
 * Running this script rewrites the text between every marker with the current
 * value from offer.json, so the T&Cs, privacy page, and sales pages can never
 * silently drift from the offer.
 *
 * Usage:
 *   node "TR Landing Page/sync-offer.mjs"           # write: sync all files in place
 *   node "TR Landing Page/sync-offer.mjs" --check   # dry run: list stale files, exit 1 if any
 *
 * Zero dependencies. Node ESM. Paths resolve relative to this file, so it works
 * from any working directory (the git pre-commit hook relies on that).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../TR Landing Page
const REPO_ROOT = join(HERE, ".."); // repo root (one level up)
const OFFER_PATH = join(HERE, "offer.json");

// Files that carry OFFER markers. Paths are relative to this script's folder.
// Missing files are skipped with a warning (they may not exist yet).
const FILES = [
  "challenge/terms.html",
  "challenge/privacy.html",
  "home/index.html",
  "coaching/index.html",
  "contentmachine/index.html",
  // Reviewed coaching contract draft lives outside TR Landing Page:
  "../Time Rich/01 Program & Offer/1-1 AI System Coaching/18b — Coaching Terms & Agreement (REVIEWED DRAFT).md",
];

const CHECK = process.argv.includes("--check");

// Match <!--OFFER:key-->...<!--/OFFER:key--> with a matching close tag.
// Key charset covers dot-paths and array indices: letters, digits, _, . and -
// [\s\S]*? spans newlines non-greedily so a marker can wrap multi-line text.
const MARKER_RE = /<!--OFFER:([A-Za-z0-9_.-]+)-->([\s\S]*?)<!--\/OFFER:\1-->/g;

/** Resolve a dot-path (supports numeric array indices) into the offer object. */
function resolve(obj, key) {
  const parts = key.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Render a resolved value to the literal text that goes between the markers. */
function render(value, key) {
  if (value === undefined) {
    return { text: null, error: `no such key in offer.json: "${key}"` };
  }
  if (value === null) {
    return { text: null, error: `key "${key}" is null in offer.json` };
  }
  if (typeof value === "object") {
    return {
      text: null,
      error: `key "${key}" points to an object/array, not a scalar value`,
    };
  }
  // Strings (may contain $ and commas), numbers, booleans -> plain string.
  return { text: String(value), error: null };
}

function loadOffer() {
  if (!existsSync(OFFER_PATH)) {
    console.error(`ERROR: offer.json not found at ${OFFER_PATH}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(OFFER_PATH, "utf8"));
  } catch (err) {
    console.error(`ERROR: could not parse offer.json: ${err.message}`);
    process.exit(2);
  }
}

/**
 * Rewrite marker contents in `content`. Returns { output, replacements, warnings }.
 * Uses a replacer FUNCTION so values containing $ (e.g. "$4,950") are inserted
 * literally and are never interpreted as regex replacement patterns ($&, $1...).
 */
function rewrite(content, offer, fileLabel) {
  const warnings = [];
  let replacements = 0;

  const output = content.replace(MARKER_RE, (match, key, inner) => {
    const { text, error } = render(resolve(offer, key), key);
    if (error) {
      warnings.push(`  ! ${fileLabel}: marker OFFER:${key} left untouched (${error})`);
      return match; // leave the marker exactly as-is
    }
    if (inner !== text) replacements++;
    // Rebuild the marker literally; no $-substitution because this is a function.
    return `<!--OFFER:${key}-->${text}<!--/OFFER:${key}-->`;
  });

  return { output, replacements, warnings };
}

function main() {
  const offer = loadOffer();

  let staleCount = 0;
  let changedCount = 0;
  let markerFiles = 0;
  const allWarnings = [];

  for (const rel of FILES) {
    const abs = join(HERE, rel);
    const label = relative(REPO_ROOT, abs) || rel;

    if (!existsSync(abs)) {
      console.warn(`skip (not found): ${label}`);
      continue;
    }

    const content = readFileSync(abs, "utf8");
    const { output, replacements, warnings } = rewrite(content, offer, label);
    allWarnings.push(...warnings);

    if (MARKER_RE.test(content)) markerFiles++;
    MARKER_RE.lastIndex = 0; // reset after .test() on a /g regex

    if (output !== content) {
      if (CHECK) {
        staleCount++;
        console.log(`STALE: ${label} (${replacements} value(s) out of date)`);
      } else {
        writeFileSync(abs, output, "utf8");
        changedCount++;
        console.log(`updated: ${label} (${replacements} value(s) synced)`);
      }
    } else {
      console.log(`ok: ${label}`);
    }
  }

  if (allWarnings.length) {
    console.warn("\nWarnings:");
    for (const w of allWarnings) console.warn(w);
  }

  if (markerFiles === 0) {
    console.warn(
      "\nNote: no OFFER markers found in any target file yet. Wrap offer-derived\n" +
        "values as <!--OFFER:key-->value<!--/OFFER:key--> so this engine can maintain them."
    );
  }

  if (CHECK) {
    if (staleCount > 0) {
      console.error(
        `\n${staleCount} file(s) are STALE vs offer.json.\n` +
          `Fix: node "TR Landing Page/sync-offer.mjs"`
      );
      process.exit(1);
    }
    console.log("\nAll pages match offer.json.");
    process.exit(0);
  }

  console.log(`\nDone. ${changedCount} file(s) updated.`);
  process.exit(0);
}

main();
