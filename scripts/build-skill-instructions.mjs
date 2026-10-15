/* =====================================================================
 * Generates portal/skill-instructions.js from the packs in downloads/.
 *
 * The portal Prompts page needs each skill's instructions in the page so
 * "Open in Claude / ChatGPT / Grok" can hand the whole skill over to a
 * member who has not installed it. The instructions are the SKILL.md
 * inside the pack, so this reads them straight out of the zips rather
 * than keeping a second copy by hand that would drift.
 *
 * The packs themselves are never touched. Run it after a pack changes:
 *
 *   node scripts/build-skill-instructions.mjs
 *
 * Zips are read with node:zlib rather than a dependency or the unzip
 * binary, so this runs the same on every machine and in CI.
 * ===================================================================== */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createContext, runInContext } from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = join(ROOT, 'downloads');
const OUT = join(ROOT, 'portal', 'skill-instructions.js');

/* ---- just enough of the zip format ------------------------------------
   Walk the central directory for the entry names, then read each one from
   its own local header: the extra field there is allowed to differ in
   length from the central directory's copy, so the data offset has to come
   from the local header or the slice lands in the wrong place. */

function entries(buf) {
  // The end-of-central-directory record is last, after a comment that may
  // be up to 64KB. Scan back for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = [];

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(at + 10);
    const compressed = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    out.push({ name, method, compressed, localAt });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function read(buf, entry) {
  if (buf.readUInt32LE(entry.localAt) !== 0x04034b50) throw new Error('bad local header');
  const nameLen = buf.readUInt16LE(entry.localAt + 26);
  const extraLen = buf.readUInt16LE(entry.localAt + 28);
  const from = entry.localAt + 30 + nameLen + extraLen;
  const raw = buf.subarray(from, from + entry.compressed);
  if (entry.method === 0) return raw.toString('utf8');
  if (entry.method === 8) return inflateRawSync(raw).toString('utf8');
  throw new Error('unsupported compression method ' + entry.method);
}

/* A pack holds SKILL.md either at the root or one directory down. Nothing
   else in the pack is instructions, so the references/ files are left out:
   they are support material the skill reads once it is installed, and
   pasting them into a chat would bury the instructions. */
function skillText(buf) {
  const found = entries(buf).filter((e) => /(^|\/)SKILL\.md$/.test(e.name));
  if (!found.length) return null;
  // Shallowest wins, so a root SKILL.md beats one nested in a sample.
  found.sort((a, b) => a.name.split('/').length - b.name.split('/').length);
  return read(buf, found[0]).replace(/\r\n/g, '\n').trim();
}

const packs = readdirSync(PACKS).filter((f) => f.endsWith('.zip')).sort();
const map = {};
const skipped = [];

for (const file of packs) {
  let text = null;
  try { text = skillText(readFileSync(join(PACKS, file))); }
  catch (err) { skipped.push(file + ' (' + err.message + ')'); continue; }
  if (!text) { skipped.push(file + ' (no SKILL.md)'); continue; }
  map[file] = text;
}

/* ---- emitting it without a 2,000-character line -----------------------
   The repo's pre-commit hook refuses any line over 2,000 characters, and a
   SKILL.md written out as one JSON string is several thousand. So each pack
   is emitted as an array of blocks that the page joins back with a newline
   the moment it loads: the string the Prompts page reads is byte for byte
   the same, it just arrives in pieces small enough to read in a diff.

   A block is a run of whole source lines, grown greedily up to the budget,
   so a block boundary always lands on a line break and the join puts the
   break back. The one case that cannot be solved that way is a single
   source line longer than the budget: that line becomes its own element,
   split again into chunks joined with "" so the text is still exact. No
   pack needs that today -- the longest line in downloads/ is about 1,050
   characters -- but without it a future pack would quietly bring back the
   very thing this function exists to prevent.

   The budget is measured on the JSON literal, not on the source text,
   because escaping is what actually grows the line. */
const LINE_BUDGET = 1400;

const lit = (value) => JSON.stringify(value);

/* The longest prefix of s whose literal still fits, by binary search: a
   character-at-a-time walk would re-stringify a long line thousands of
   times. A slice can cut a surrogate pair in half, which is safe here --
   each half is escaped on its own and concatenating them back at load time
   gives the original character. */
function fits(s) {
  if (lit(s).length <= LINE_BUDGET) return s.length;
  let lo = 1, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lit(s.slice(0, mid)).length <= LINE_BUDGET) lo = mid; else hi = mid - 1;
  }
  return lo;
}

function chunk(line) {
  const parts = [];
  let rest = line;
  while (rest) {
    const take = fits(rest);
    parts.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  return parts;
}

/* The array elements for one pack. The invariant the whole thing rests on:
   joining the elements with a newline at load time gives back the SKILL.md
   exactly, which is what checkOutput below proves before anything is
   written. */
function elementsFor(text) {
  const els = [];
  let cur = [];
  const flush = () => { if (cur.length) { els.push(lit(cur.join('\n'))); cur = []; } };

  for (const line of text.split('\n')) {
    if (lit(line).length > LINE_BUDGET) {
      flush();
      els.push('[' + chunk(line).map(lit).join(', ') + "].join('')");
      continue;
    }
    if (cur.length && lit(cur.concat(line).join('\n')).length > LINE_BUDGET) flush();
    cur.push(line);
  }
  flush();
  return els;
}

const names = Object.keys(map).sort();
const body = names.map((f) => {
  const els = elementsFor(map[f]);
  return '    ' + lit(f) + ': [\n' +
         els.map((e) => '      ' + e).join(',\n') +
         "\n    ].join('\\n')";
}).join(',\n');

/* Two things this generator promises, both checked before a byte is
   written, because getting either wrong is silent: the hook would reject
   the commit, or the Prompts page would hand an AI subtly wrong text.

   The round trip is evaluated, not eyeballed: the emitted source is run the
   way the browser runs it and the resulting map is compared to the packs. */
function checkOutput(source) {
  const over = source.split('\n')
    .map((line, i) => ({ n: i + 1, len: line.length }))
    .filter((l) => l.len > 2000);
  if (over.length) {
    throw new Error('line over 2,000 characters: ' +
      over.map((l) => l.n + ' (' + l.len + ')').join(', '));
  }

  const sandbox = { window: {} };
  createContext(sandbox);
  runInContext(source, sandbox);
  const got = sandbox.window.TRSkillText;
  for (const name of names) {
    if (got[name] !== map[name]) {
      throw new Error('round trip changed ' + name);
    }
  }
  if (Object.keys(got).length !== names.length) {
    throw new Error('round trip changed the number of packs');
  }
}

const source = `/* =====================================================================
 * Skill instructions, for the "Open in your AI" buttons on the Prompts
 * page. One entry per pack in downloads/, keyed by the file name a card
 * carries, holding that pack's SKILL.md verbatim.
 *
 * GENERATED FILE. Do not edit by hand: run
 *     node scripts/build-skill-instructions.mjs
 * which reads the packs themselves, so this can never drift from them.
 *
 * A card with no entry here grows no AI buttons, because a trigger phrase
 * on its own does nothing in an AI that has not installed the skill.
 * ===================================================================== */
(function (window) {
  'use strict';
  window.TRSkillText = {
${body}
  };
})(window);
`;

checkOutput(source);
writeFileSync(OUT, source, 'utf8');

console.log('wrote ' + OUT);
console.log(names.length + ' packs: ' + names.join(', '));
if (skipped.length) console.log('skipped: ' + skipped.join(', '));
