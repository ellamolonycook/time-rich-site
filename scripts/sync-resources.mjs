#!/usr/bin/env node
// ============================================================================
// TIME RICH — RESOURCES SYNC
// ----------------------------------------------------------------------------
// Turns Ella's Substack into on-site resource pages, formatted on-brand.
//
// What it does (idempotent — safe to run weekly):
//   1. Fetches the Substack RSS feed
//   2. Finds posts that aren't already published on the site
//   3. Downloads each cover image into Images/resources/
//   4. Generates a full, Substack-style article page in resources/<slug>.html
//      (with a canonical tag back to Substack to protect SEO)
//   5. Rebuilds resources-manifest.json and the resource hub (resources.html)
//
// Run it:
//   node scripts/sync-resources.mjs            # live fetch
//   node scripts/sync-resources.mjs --dry      # show what WOULD change, write nothing
//
// No npm install needed. Node 18+ (uses global fetch).
// ============================================================================

import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Which Substack to pull from. Override without editing code:
//   SUBSTACK_FEED="https://timerichai.substack.com/feed" node scripts/sync-resources.mjs
// As of build time, the real posts live on iiculture; the @timerichai publication
// ("Time Rich") has no published posts yet — switch the default below once it does.
const FEED_URL = process.env.SUBSTACK_FEED || 'https://iiculture.substack.com/feed';
const SUBSTACK_HOME = (process.env.SUBSTACK_HOME || FEED_URL.replace(/\/feed\/?$/, '/'));
const SITE = 'https://timerich.ai';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES_DIR = join(ROOT, 'resources');
const IMG_DIR = join(ROOT, 'Images', 'resources');
const MANIFEST = join(ROOT, 'resources-manifest.json');
const HUB = join(ROOT, 'resources.html');
const DRY = process.argv.includes('--dry');

// Categories mirror the homepage filter chips. First keyword hit wins, so the
// specific buckets are checked BEFORE the "agents" catch-all (most titles say
// "agent"). Categories are editable per-post afterwards in resources-manifest.json.
const CATEGORIES = [
  { key: 'skills',    label: 'Skills',          kw: ['prompt', 'skill', 'sop', 'playbook', 'origin story'] },
  { key: 'community', label: 'Community',        kw: ['workshop', 'event', 'tech week', 'community', 'dinner'] },
  { key: 'adoption',  label: 'Adoption Gap',    kw: ['adoption gap', 'women adopt', 'safety', 'behind on ai'] },
  { key: 'stories',   label: 'Founder Stories', kw: ['founder story', 'my journey', 'how i exited'] },
  { key: 'workflows', label: 'Workflows',       kw: ['workflow', 'operating system', 'my system for'] },
  { key: 'agents',    label: 'AI Agents',       kw: ['agent', 'automation', 'mapped'] },
];

function classify(title, dek) {
  const hay = (title + ' ' + dek).toLowerCase();
  for (const c of CATEGORIES) if (c.kw.some((k) => hay.includes(k))) return c;
  return { key: 'skills', label: 'Guide' };
}

// ---- tiny XML helpers (Substack feeds are regular; no parser dependency) ----
function decodeCdata(s = '') {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeCdata(m[1]) : '';
}
function attr(block, name, a) {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${a}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}
function esc(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugFromLink(link) {
  const m = link.match(/\/p\/([^/?#]+)/);
  return m ? m[1] : link.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}
function isoDate(pub) {
  const d = new Date(pub);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}
function niceDate(pub) {
  const d = new Date(pub);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// ---- clean Substack's post HTML into a lean, on-brand article body ----------
function sanitizeBody(html) {
  let out = html;
  // Strip Substack's subscription / share / button widgets and captions cruft.
  out = out.replace(/<div class="subscription-widget[\s\S]*?<\/div>\s*<\/div>/gi, '');
  out = out.replace(/<div class="subscribe-widget[\s\S]*?<\/div>/gi, '');
  out = out.replace(/<p class="button-wrapper"[\s\S]*?<\/p>/gi, '');
  out = out.replace(/<div class="captioned-image-container">/gi, '<figure class="ph">');
  out = out.replace(/<\/figure>/gi, '</figure>');
  // Substack wraps images in <a> to a lightbox — unwrap so images just render.
  out = out.replace(/<a class="image-link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  // Drop tracking/pixel and script/style if any slipped in.
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  return out.trim();
}

// ---- the article page template ---------------------------------------------
function articlePage(r) {
  const canonical = r.substackUrl;
  const cover = r.coverLocal
    ? `<img class="r-cover" src="../${r.coverLocal}" alt="${esc(r.title)}" />`
    : '';
  const ogImg = r.coverLocal ? `${SITE}/${r.coverLocal}` : `${SITE}/og-image.jpg`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(r.title)} — Time Rich</title>
  <meta name="description" content="${esc(r.dek)}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(r.title)}" />
  <meta property="og:description" content="${esc(r.dek)}" />
  <meta property="og:image" content="${ogImg}" />
  <meta property="article:published_time" content="${r.date}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800;900&family=DM+Serif+Display&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet" />
  <style>
    :root { --indigo:#4A2E6F; --charcoal:#44414D; --gold:#E7A83C; --sand:#F6F1FB; --line:rgba(74,46,111,0.12);
      --rainbow: linear-gradient(90deg,#ff5f6d,#ffc371,#47e891,#36d1dc,#9b5de5,#ff5f6d);
      --rainbow-pastel: linear-gradient(90deg,#ff8fa3,#ffc56b,#ffe85e,#6fe39a,#6fc4ff,#c08bff,#ff8fa3); }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Source Serif 4', Georgia, serif; color:var(--charcoal); background:#fff; line-height:1.7;
      border-top:5px solid transparent; border-image:var(--rainbow) 1; }
    .r-nav { display:flex; align-items:center; justify-content:space-between; max-width:760px; margin:0 auto; padding:22px 24px; }
    .r-nav .brand { font-family:'Archivo',sans-serif; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; color:var(--indigo); text-decoration:none; font-size:19px; }
    .r-nav a.back { font-family:'Archivo',sans-serif; font-weight:700; font-size:14px; color:var(--indigo); text-decoration:none; }
    .r-wrap { max-width:720px; margin:0 auto; padding:20px 24px 90px; }
    .r-eyebrow { font-family:'Archivo',sans-serif; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; font-size:12px; color:var(--gold); }
    .r-title { font-family:'Archivo',sans-serif; font-weight:900; color:var(--indigo); line-height:1.08; font-size:clamp(30px,5vw,46px); margin:14px 0 12px; }
    .r-meta { font-family:'Archivo',sans-serif; font-size:14px; color:#9a8ab0; margin-bottom:26px; }
    .r-dek { font-size:20px; color:var(--indigo); font-style:italic; margin-bottom:30px; }
    .r-cover { width:100%; border-radius:16px; display:block; margin:0 0 34px; }
    .r-body { font-size:19px; }
    .r-body p { margin:0 0 22px; }
    .r-body h2, .r-body h3 { font-family:'Archivo',sans-serif; color:var(--indigo); margin:34px 0 14px; line-height:1.2; }
    .r-body h2 { font-size:27px; } .r-body h3 { font-size:22px; }
    .r-body a { color:var(--indigo); text-decoration:underline; text-underline-offset:2px; }
    .r-body img { max-width:100%; height:auto; border-radius:12px; display:block; margin:8px 0 10px; }
    .r-body figure { margin:0 0 24px; } .r-body figcaption { font-size:14px; color:#9a8ab0; text-align:center; margin-top:8px; }
    .r-body ul, .r-body ol { margin:0 0 22px 24px; } .r-body li { margin-bottom:8px; }
    .r-body blockquote { border-left:4px solid var(--gold); padding:4px 0 4px 20px; margin:0 0 24px; color:var(--indigo); font-style:italic; }
    .r-cta { margin:48px 0 0; background:var(--sand); border:1px solid var(--line); border-radius:18px; padding:32px; text-align:center; }
    .r-cta h3 { font-family:'Archivo',sans-serif; font-weight:900; color:var(--indigo); font-size:22px; margin-bottom:8px; }
    .r-cta p { font-size:16px; margin-bottom:20px; }
    .r-btn { display:inline-block; font-family:'Archivo',sans-serif; font-weight:800; text-decoration:none; color:#14101a;
      background:var(--rainbow-pastel); background-size:220% 100%; padding:15px 30px; border-radius:999px; }
    .r-btn.ghost { background:transparent; border:1.5px solid var(--indigo); color:var(--indigo); margin-left:10px; }
    .r-foot { text-align:center; padding:30px 24px 60px; font-family:'Archivo',sans-serif; font-size:13px; color:#9a8ab0; }
    .r-foot a { color:var(--indigo); text-decoration:none; }
    @media (max-width:600px){ .r-btn.ghost{ margin-left:0; margin-top:12px; } }
  </style>
</head>
<body>
  <nav class="r-nav">
    <a class="brand" href="/">Time Rich 🍒</a>
    <a class="back" href="/resources.html">← All resources</a>
  </nav>
  <article class="r-wrap">
    <div class="r-eyebrow">${esc(r.categoryLabel)}</div>
    <h1 class="r-title">${esc(r.title)}</h1>
    <div class="r-meta">${niceDate(r.pubDate)} · from The Self-Improvement Loop</div>
    ${r.dek ? `<p class="r-dek">${esc(r.dek)}</p>` : ''}
    ${cover}
    <div class="r-body">
${r.body}
    </div>
    <div class="r-cta">
      <h3>Want the drops the second they land? 🌈</h3>
      <p>New AI playbooks, prompts and agent breakdowns every week — free.</p>
      <a class="r-btn" href="${SUBSTACK_HOME}" target="_blank" rel="noopener">Subscribe on Substack ☕</a>
      <a class="r-btn ghost" href="/#apply">Join the Club</a>
    </div>
  </article>
  <div class="r-foot">
    Originally published on <a href="${canonical}" target="_blank" rel="noopener">Substack</a> ·
    <a href="/">timerich.ai</a> · Built by baddies who love AI 🪄🍒
  </div>
</body>
</html>`;
}

// ---- the resource hub (index of all resources) -----------------------------
function hubPage(items) {
  const cards = items.map((r) => `
      <article class="rh-card" data-topic="${r.category}">
        <a class="rh-link" href="resources/${r.slug}.html">
          ${r.coverLocal ? `<img class="rh-img" src="${r.coverLocal}" alt="${esc(r.title)}" loading="lazy" />`
            : `<div class="rh-img rh-noimg">🍒</div>`}
          <div class="rh-body">
            <div class="rh-badge">${esc(r.categoryLabel)}</div>
            <h3>${esc(r.title)}</h3>
            <p>${esc(r.dek)}</p>
            <div class="rh-date">${niceDate(r.pubDate)}</div>
          </div>
        </a>
      </article>`).join('\n');

  const chips = [{ key: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.label }))]
    .map((c, i) => `<button class="rh-chip${i === 0 ? ' active' : ''}" data-filter="${c.key}">${c.label}</button>`).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Free AI Resources — Time Rich</title>
  <meta name="description" content="Free AI playbooks, prompts, and agent breakdowns from Time Rich — delegate the shit you hate to AI and buy back your time." />
  <link rel="canonical" href="${SITE}/resources.html" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800;900&family=Source+Serif+4:opsz,wght@8..60,400&display=swap" rel="stylesheet" />
  <style>
    :root { --indigo:#4A2E6F; --charcoal:#44414D; --gold:#E7A83C; --sand:#F6F1FB; --line:rgba(74,46,111,0.12);
      --rainbow: linear-gradient(90deg,#ff5f6d,#ffc371,#47e891,#36d1dc,#9b5de5,#ff5f6d);
      --rainbow-pastel: linear-gradient(90deg,#ff8fa3,#ffc56b,#ffe85e,#6fe39a,#6fc4ff,#c08bff,#ff8fa3); }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Source Serif 4', Georgia, serif; color:var(--charcoal); background:#fff;
      border-top:5px solid transparent; border-image:var(--rainbow) 1; }
    .rh-nav { display:flex; align-items:center; justify-content:space-between; max-width:1080px; margin:0 auto; padding:22px 28px; }
    .rh-nav .brand { font-family:'Archivo',sans-serif; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; color:var(--indigo); text-decoration:none; font-size:19px; }
    .rh-nav a.back { font-family:'Archivo',sans-serif; font-weight:700; font-size:14px; color:var(--indigo); text-decoration:none; }
    .rh-head { max-width:1080px; margin:0 auto; padding:34px 28px 8px; }
    .rh-eyebrow { font-family:'Archivo',sans-serif; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; font-size:12px; color:var(--gold); }
    .rh-h1 { font-family:'Archivo',sans-serif; font-weight:900; color:var(--indigo); font-size:clamp(32px,5vw,54px); line-height:1.04; margin:12px 0 14px; }
    .rh-sub { font-size:19px; max-width:560px; }
    .rh-filters { max-width:1080px; margin:0 auto; padding:26px 28px 6px; display:flex; flex-wrap:wrap; gap:10px; }
    .rh-chip { font-family:'Archivo',sans-serif; font-weight:700; font-size:14px; padding:9px 16px; border-radius:999px; border:1.5px solid var(--line); background:#fff; color:var(--indigo); cursor:pointer; }
    .rh-chip.active { background:var(--rainbow-pastel); background-size:220% 100%; border-color:transparent; color:#14101a; }
    .rh-grid { max-width:1080px; margin:0 auto; padding:20px 28px 80px; display:grid; grid-template-columns:repeat(3,1fr); gap:26px; }
    .rh-card { border:1px solid var(--line); border-radius:16px; overflow:hidden; background:#fff; transition:transform .16s ease, box-shadow .25s ease; }
    .rh-card:hover { transform:translateY(-4px); box-shadow:0 18px 44px rgba(74,46,111,0.14); }
    .rh-link { text-decoration:none; color:inherit; display:block; }
    .rh-img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; background:var(--sand); }
    .rh-noimg { display:flex; align-items:center; justify-content:center; font-size:44px; }
    .rh-body { padding:20px; }
    .rh-badge { font-family:'Archivo',sans-serif; font-weight:800; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--gold); margin-bottom:10px; }
    .rh-card h3 { font-family:'Archivo',sans-serif; font-size:20px; font-weight:800; color:var(--indigo); line-height:1.18; margin-bottom:9px; }
    .rh-card p { font-size:15px; line-height:1.5; }
    .rh-date { font-family:'Archivo',sans-serif; font-size:12.5px; color:#9a8ab0; margin-top:14px; }
    .rh-foot { text-align:center; padding:36px 24px 60px; font-family:'Archivo',sans-serif; font-size:13px; color:#9a8ab0; }
    .rh-foot a { color:var(--indigo); text-decoration:none; }
    @media (max-width:900px){ .rh-grid { grid-template-columns:1fr 1fr; } }
    @media (max-width:600px){ .rh-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <nav class="rh-nav">
    <a class="brand" href="/">Time Rich 🍒</a>
    <a class="back" href="/">← Back to site</a>
  </nav>
  <header class="rh-head">
    <div class="rh-eyebrow">Free Resources</div>
    <h1 class="rh-h1">Delegate the shit you hate to AI.</h1>
    <p class="rh-sub">Playbooks, prompts and agent breakdowns — the good stuff, free. Not AI awareness. Implementation.</p>
  </header>
  <div class="rh-filters" id="rhFilters">
        ${chips}
  </div>
  <main class="rh-grid" id="rhGrid">${cards}
  </main>
  <div class="rh-foot">
    New drops weekly · <a href="${SUBSTACK_HOME}" target="_blank" rel="noopener">Subscribe on Substack ☕</a> · <a href="/#apply">Join the Club 🌈</a>
  </div>
  <script>
    var f = document.getElementById('rhFilters');
    f && f.addEventListener('click', function (e) {
      var b = e.target.closest('.rh-chip'); if (!b) return;
      f.querySelectorAll('.rh-chip').forEach(function (c){ c.classList.remove('active'); });
      b.classList.add('active');
      var val = b.getAttribute('data-filter');
      document.querySelectorAll('#rhGrid .rh-card').forEach(function (card){
        card.style.display = (val === 'all' || card.getAttribute('data-topic') === val) ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;
}

// ---- image download --------------------------------------------------------
async function downloadCover(url, slug) {
  if (!url) return '';
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp|gif)/i) || [, 'jpg'])[1].toLowerCase();
    const rawRel = join('Images', 'resources', `${slug}.${ext}`).replace(/\\/g, '/');
    if (DRY) return rawRel;
    mkdirSync(IMG_DIR, { recursive: true });
    const rawAbs = join(ROOT, rawRel);
    writeFileSync(rawAbs, buf);
    // Optimize to a web-friendly jpg when macOS `sips` is available; otherwise keep original.
    const jpgRel = join('Images', 'resources', `${slug}.jpg`).replace(/\\/g, '/');
    try {
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '74',
        '--resampleWidth', '1200', rawAbs, '--out', join(ROOT, jpgRel)], { stdio: 'ignore' });
      if (rawRel !== jpgRel) unlinkSync(rawAbs);
      return jpgRel;
    } catch { return rawRel; }
  } catch { return ''; }
}

// ---- main ------------------------------------------------------------------
async function main() {
  let xml;
  try {
    const res = await fetch(FEED_URL);
    xml = await res.text();
  } catch (e) {
    const local = join(ROOT, '..', 'feed.xml');
    if (existsSync(local)) xml = readFileSync(local, 'utf8');
    else { console.error('Could not fetch feed and no local feed.xml fallback.'); process.exit(1); }
  }

  const items = (xml.split(/<item>/).slice(1)).map((b) => '<item>' + b.split('</item>')[0]);
  const existing = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : [];
  const bySlug = new Map(existing.map((r) => [r.slug, r]));

  const parsed = [];
  for (const block of items) {
    const link = tag(block, 'link');
    const slug = slugFromLink(link);
    const title = tag(block, 'title');
    const dek = tag(block, 'description').replace(/<[^>]+>/g, '').trim();
    const pubDate = tag(block, 'pubDate');
    const bodyRaw = tag(block, 'content:encoded');
    const coverUrl = attr(block, 'enclosure', 'url');
    const cat = classify(title, dek);
    parsed.push({ slug, link, title, dek, pubDate, bodyRaw, coverUrl, cat });
  }

  let added = 0;
  for (const p of parsed) {
    if (bySlug.has(p.slug)) continue; // idempotent: already published
    added++;
    console.log(`${DRY ? '[dry] would add' : 'adding'}: ${p.title}  (${p.cat.label})`);
    const coverLocal = await downloadCover(p.coverUrl, p.slug);
    const record = {
      slug: p.slug,
      title: p.title,
      dek: p.dek,
      date: isoDate(p.pubDate),
      pubDate: p.pubDate,
      category: p.cat.key,
      categoryLabel: p.cat.label,
      coverLocal,
      substackUrl: p.link,
    };
    const page = articlePage({ ...record, body: sanitizeBody(p.bodyRaw) });
    if (!DRY) { mkdirSync(RES_DIR, { recursive: true }); writeFileSync(join(RES_DIR, `${p.slug}.html`), page); }
    bySlug.set(p.slug, record);
  }

  // Rebuild manifest + hub, newest first.
  const all = [...bySlug.values()].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  if (!DRY) {
    writeFileSync(MANIFEST, JSON.stringify(all, null, 2));
    writeFileSync(HUB, hubPage(all));
  }
  console.log(`\n${DRY ? 'DRY RUN — ' : ''}${added} new resource(s). Total: ${all.length}.`);
  console.log(DRY ? 'Nothing written.' : 'Wrote resources/*.html, Images/resources/*, resources-manifest.json, resources.html');
}

main();
