// Time Rich — application intake Worker.
// Receives the JSON the website form sends and creates a page (row) in a Notion
// database. It reads your database schema first, so it only writes to columns
// that actually exist — and it always writes the full submission into the page
// body, so nothing is ever lost even if a column is missing.
//
// It also powers the corner chatbot ("the brain") at POST /chat — see brain.js.

import { SYSTEM_PROMPT } from "./brain.js";

const NOTION_VERSION = "2022-06-28";

// Chatbot config
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"; // cheap + good; swap for a Sonnet id if you want more depth
const MAX_USER_CHARS = 1500;   // per-message length guard (abuse / cost control)
const MAX_TURNS = 16;          // how many prior messages we keep in context
const MAX_OUTPUT_TOKENS = 600; // keeps replies short + cheap

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    // Route: corner chatbot -> Anthropic.
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (path.endsWith("/chat")) {
      return handleChat(request, env, cors);
    }

    // Route: 1:1 AI OS Coaching intake -> its own Notion database (precise field mapping).
    if (path.endsWith("/coaching")) {
      return handleCoaching(request, env, cors);
    }

    // Route: Super Human Accelerator waitlist -> its own Notion database (precise field mapping).
    if (path.endsWith("/waitlist")) {
      return handleWaitlist(request, env, cors);
    }

    // Route: Cal.com booking webhook -> Notion (update the application) + Slack.
    // Must run before request.json() below: the HMAC is over the RAW request body.
    if (path.endsWith("/cal-webhook")) {
      return handleCalWebhook(request, env, cors, ctx);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    // Route: Super Human Accelerator application -> its own Notion database.
    if (path.endsWith("/superhuman")) {
      // The rebuilt /sh-apply form (nine questions, one at a time) posts a
      // snake_case payload and is mapped property-by-property below, the same
      // way /waitlist is: the select columns have fixed option sets and free
      // text must never be allowed to invent new options.
      if (data.form_version === "sh-apply-v2") {
        return handleSuperhumanApplication(data, env, cors);
      }
      // Anything else is the previous form's payload (keys already equal to the
      // Notion property names) — left on the schema-driven mapper so an older
      // cached page still lands somewhere while the new one rolls out.
      const res = await createApplication(data, env, cors, env.NOTION_SUPERHUMAN_DATABASE_ID, { Status: "New" });
      if (res.status < 500) return res;
      // Safety net: if that DB isn't shared with the integration (yet), capture the
      // application in the main applications DB instead of losing it.
      const marked = { ...data, "Full name": "SUPER HUMAN — " + (data["Name"] || data["Full name"] || "Applicant") };
      return createApplication(marked, env, cors, env.NOTION_DATABASE_ID);
    }

    // Route: qualify form (/qualifyform) -> its own Notion database.
    // Eleven questions, mapped property-by-property below the same way
    // /superhuman is: this database's select and multi-select columns have
    // fixed option sets, and nothing the browser sends may invent a new one.
    if (path.endsWith("/qualify")) {
      return handleQualify(data, env, cors);
    }

    // Route: AI Revenue Accelerator application -> its own Notion database.
    // Same schema-driven mapping as the club form; stamps Status = New so the
    // "Call today" / pipeline views pick fresh applications up.
    if (path.endsWith("/accelerator")) {
      const res = await createApplication(data, env, cors, env.NOTION_ACCELERATOR_DATABASE_ID, { Status: "New" });
      if (res.status < 500) return res;
      // Safety net: if the accelerator DB isn't shared with the integration (yet),
      // capture the application in the main applications DB instead of losing it.
      const marked = { ...data, "Full name": "ACCELERATOR — " + (data["Name"] || data["Full name"] || "Applicant") };
      return createApplication(marked, env, cors, env.NOTION_DATABASE_ID);
    }

    // Application submission (club form) -> Notion.
    return createApplication(data, env, cors, env.NOTION_DATABASE_ID);
  },
};

// Generic application intake: reads the target database schema, maps matching
// fields, and always dumps the full submission into the page body.
async function createApplication(data, env, cors, dbId, defaults) {
    if (!env.NOTION_TOKEN || !dbId) {
      return json({ error: "Server not configured" }, 500, cors);
    }

    // Anti-spam: silently accept bot submissions (honeypot field filled in).
    if (data._gotcha) return json({ ok: true }, 200, cors);
    if (!data["Email"] && !data.email) {
      return json({ error: "Email is required" }, 400, cors);
    }
    if (defaults) {
      for (const [k, v] of Object.entries(defaults)) {
        if (!String(data[k] || "").trim()) data[k] = v;
      }
    }

    try {
      // 1) Read the database schema to learn property names + types.
      const dbRes = await fetch(
        `https://api.notion.com/v1/databases/${dbId}`,
        { headers: authHeaders(env) }
      );
      if (!dbRes.ok) {
        return json({ error: "Notion DB fetch failed", detail: await dbRes.text() }, 502, cors);
      }
      const db = await dbRes.json();
      const schema = db.properties || {};
      const byLower = {};
      for (const name of Object.keys(schema)) byLower[name.toLowerCase()] = name;
      const titleName = Object.keys(schema).find((n) => schema[n].type === "title");

      // 2) Map known fields to matching columns.
      const properties = {};
      const fullName = String(data["Full name"] || data["Name"] || "Applicant");
      if (titleName) {
        properties[titleName] = { title: [{ text: { content: clip(fullName, 2000) } }] };
      }
      for (const [key, raw] of Object.entries(data)) {
        if (key.startsWith("_")) continue;
        const value = (raw == null ? "" : String(raw)).trim();
        if (!value) continue;
        const propName = byLower[key.toLowerCase()];
        if (!propName || propName === titleName) continue;
        properties[propName] = buildProp(schema[propName].type, value);
      }

      // 3) Full readable dump in the page body (guaranteed capture).
      const children = Object.entries(data)
        .filter(([k, v]) => !k.startsWith("_") && String(v || "").trim())
        .map(([k, v]) => paragraph(`${k}: ${String(v).trim()}`));

      // 4) Create the page.
      const createRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: { ...authHeaders(env), "Content-Type": "application/json" },
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties,
          children: children.slice(0, 100), // Notion caps children at 100 per request
        }),
      });
      if (!createRes.ok) {
        return json({ error: "Notion create failed", detail: await createRes.text() }, 502, cors);
      }
      return json({ ok: true }, 200, cors);
    } catch (err) {
      return json({ error: "Unexpected error", detail: String(err) }, 500, cors);
    }
}

// Corner chatbot. Accepts { messages: [{role, content}, ...] }, calls Claude with
// the Time Rich brain as the system prompt, returns { ok, reply }.
async function handleChat(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ ok: false, configured: false, error: "Chat isn't switched on yet." }, 200, cors);
  }

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400, cors); }

  // Clean + clamp the conversation we received from the browser.
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: clip(m.content.trim(), MAX_USER_CHARS) }))
    .filter((m) => m.content)
    .slice(-MAX_TURNS);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ ok: false, error: "Say something first." }, 400, cors);
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!r.ok) {
      return json({ ok: false, error: "The brain is having a moment. Try again in a sec." }, 502, cors);
    }
    const data = await r.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return json({ ok: true, reply: reply || "Hmm, I blanked. Ask me again?" }, 200, cors);
  } catch (err) {
    return json({ ok: false, error: "Couldn't reach the brain. Try again." }, 500, cors);
  }
}

// 1:1 AI OS Coaching intake -> the "AI Coaching Intake Form" Notion database.
// Uses an exact field map (this form's columns are known + fixed), including the
// date property and multi-selects. Writes to env.NOTION_COACHING_DATABASE_ID.
async function handleCoaching(request, env, cors) {
  const dbId = env.NOTION_COACHING_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) {
    return json({ ok: false, error: "Coaching intake not configured" }, 500, cors);
  }

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400, cors); }
  if (d._gotcha) return json({ ok: true }, 200, cors);           // honeypot: silently accept bots
  if (!d.first_name || !d.email) return json({ ok: false, error: "Missing name or email" }, 400, cors);

  // Form option value -> exact Notion option name (only where they differ), so the
  // tool-agnostic form labels never create duplicate select options in the DB.
  const NORMALIZE = {
    role: { "First-time founder": "First time Founder" },
    ai_stage: {
      "Using daily": "Using Daily",
      "Building systems": "Building Systems",
      "Using AI at the code level": "Leveraging Claude Code",
      "Running scheduled / autonomous agent tasks": "Scheduled Tasks in Cowork",
    },
    blockers: { "Team buy-in": "Team Buy-in" },
  };
  const norm = (f, arr) => (arr || []).map((v) => (NORMALIZE[f] && NORMALIZE[f][v]) || v);
  const rich = (s) => (s ? [{ text: { content: clip(String(s), 2000) } }] : []);
  const opts = (arr) => (arr || []).map((name) => ({ name }));
  const url = (s) => (s ? (/^https?:\/\//i.test(s) ? s : `https://${s}`) : null);

  const properties = {
    "First Name (1)": { title: rich(d.first_name) },
    Email: { email: d.email || null },
    Role: { multi_select: opts(norm("role", d.role)) },
    "How many people on your team? ": { rich_text: rich(d.team_size) },
    "LinkedIn Profile": { url: url(d.linkedin) },
    "Where are you at with AI?": { multi_select: opts(norm("ai_stage", d.ai_stage)) },
    "What's costing you the most time right now?": { rich_text: rich(d.time_drain) },
    "What's holding you back?": { multi_select: opts(norm("blockers", d.blockers)) },
    "What's the ONE thing AI could do that would change your business?": { rich_text: rich(d.one_thing) },
    "What is the cost of you not implementing AI?": { rich_text: rich(d.cost_of_inaction) },
    "Which offer do you want? ": { multi_select: opts(d.offer) },
    "Whats your budget?": { rich_text: rich(d.budget) },
    "Why do you want to work with Ella?": { rich_text: rich(d.why_ella) },
    Status: { select: { name: "New Inquiry" } },
  };
  if (d.start_when) properties["How urgent is this for you?"] = { date: { start: d.start_when } };

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    });
    if (!res.ok) return json({ ok: false, error: "Notion create failed", detail: await res.text() }, 502, cors);
    return json({ ok: true }, 200, cors);
  } catch (err) {
    return json({ ok: false, error: "Unexpected error", detail: String(err) }, 500, cors);
  }
}

// Super Human Accelerator waitlist (/accelerator page). Precise field mapping:
// the property names below must match that database's schema exactly.
async function handleWaitlist(request, env, cors) {
  const dbId = env.NOTION_WAITLIST_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) {
    return json({ ok: false, error: "Waitlist not configured" }, 500, cors);
  }

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400, cors); }
  if (d._gotcha) return json({ ok: true }, 200, cors);           // honeypot: silently accept bots

  const firstName = String(d.first_name || "").trim();
  const email = String(d.email || "").trim();
  if (!firstName || !email) return json({ ok: false, error: "Missing name or email" }, 400, cors);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: "Invalid email" }, 400, cors);
  }

  const rich = (s) => (s ? [{ text: { content: clip(String(s), 2000) } }] : []);
  const social = String(d.social_media || "").trim();

  const properties = {
    "First name": { title: rich(firstName) },
    "Email": { email: email },
    "What does your business do, in one line?": { rich_text: rich(d.business) },
    "Which department would you fix first?": { rich_text: rich(d.department) },
  };
  // Notion rejects "" for a url property, so the column is only sent when filled.
  if (social) {
    properties["Social media"] = { url: /^https?:\/\//i.test(social) ? social : `https://${social}` };
  }

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    });
    if (!res.ok) return json({ ok: false, error: "Notion create failed", detail: await res.text() }, 502, cors);
    return json({ ok: true }, 200, cors);
  } catch (err) {
    return json({ ok: false, error: "Unexpected error", detail: String(err) }, 500, cors);
  }
}

// Super Human Accelerator application (/sh-apply, form_version "sh-apply-v2").
// Precise field mapping — the property names and select option names below must
// match the live "Super Human Accelerator Applications" schema exactly.
// Deliberately does NOT write: Call time and Video watched (set later by the
// booking webhook / player events), or any of the old form's columns.
const SH_DEPARTMENTS = [
  "Sales",
  "Marketing & content",
  "Delivery / client success",
  "Operations & admin",
  "Finance",
  "Hiring & team",
  "Not sure yet",
];
const SH_TRACKS = ["Six weeks", "Ten weeks", "Not sure"];
const SH_COACHING = ["Yes", "No", "Tell me more"];

async function handleSuperhumanApplication(d, env, cors) {
  const dbId = env.NOTION_SUPERHUMAN_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) {
    return json({ ok: false, error: "Super Human application not configured" }, 500, cors);
  }
  if (d._gotcha) return json({ ok: true }, 200, cors);            // honeypot: silently accept bots

  const firstName = String(d.first_name || "").trim();
  const email = String(d.email || "").trim();
  if (!firstName || !email) return json({ ok: false, error: "Missing name or email" }, 400, cors);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: "Invalid email" }, 400, cors);
  }

  const rich = (s) => {
    const v = String(s == null ? "" : s).trim();
    return v ? [{ text: { content: clip(v, 2000) } }] : [];
  };
  // Only ever write an option the database already has; an unexpected value is
  // dropped rather than silently creating a new select option.
  const pick = (value, allowed) => {
    const v = String(value == null ? "" : value).trim();
    return allowed.includes(v) ? { select: { name: v } } : null;
  };
  const e164 = (s) => {
    const v = String(s || "").replace(/[\s()\-.]/g, "");
    return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;
  };
  const link = (s) => {
    const v = String(s || "").trim();
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  };

  const properties = {
    "Name": { title: rich(firstName) },
    "Email": { email: email },
    "Business": { rich_text: rich(d.business) },
    "Outcome": { rich_text: rich(d.outcome) },
    "Coaching focus": { rich_text: rich(d.coaching_focus) },
    "Source": { rich_text: rich(d.source) },
    "Status": { select: { name: "New" } },
  };
  // Notion rejects "" for phone_number / url, so those columns are only sent
  // when there is a real value to send.
  const phone = e164(d.phone);
  if (phone) properties["Phone"] = { phone_number: phone };
  // Q4 is optional and has two modes: a LinkedIn profile, or - for anyone who
  // said they don't use LinkedIn - a website or Instagram link. The form sends
  // whichever one it collected, so each lands in its own column.
  const linkedin = link(d.linkedin);
  if (linkedin) properties["LinkedIn"] = { url: linkedin };
  const website = link(d.website);
  if (website) properties["Website"] = { url: website };

  const department = pick(d.department, SH_DEPARTMENTS);
  if (department) properties["Department"] = department;
  const track = pick(d.track, SH_TRACKS);
  if (track) properties["Track preference"] = track;
  const coaching = pick(d.coaching, SH_COACHING);
  if (coaching) properties["1:1 coaching"] = coaching;

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    });
    if (!res.ok) return json({ ok: false, error: "Notion create failed", detail: await res.text() }, 502, cors);
    return json({ ok: true }, 200, cors);
  } catch (err) {
    return json({ ok: false, error: "Unexpected error", detail: String(err) }, 500, cors);
  }
}

// Qualify form (/qualifyform). Precise field mapping - the property names and
// option names below must match the live qualify database's schema exactly.
// Everything the form can send is either a title, an email, a url, or one of the
// fixed option sets here; there is no free text on this form at all.
// Straight apostrophe in "I'm" - that is the character the Notion option uses,
// and a curly one here would be silently dropped instead of written.
const Q_MEMBER = ["I'm already part of it", "Not interested", "Tell me more"];
const Q_REFERRALS = ["Yes", "No", "Tell me more"];
const Q_US_BASED = ["Yes", "No"];
const Q_ROLES = [
  "Founder / Co-founder",
  "CEO",
  "COO / President",
  "CFO / Finance lead",
  "CMO / Marketing lead",
  "CRO / Sales lead",
  "CTO / Engineering lead",
  "Head of People / HR",
  "Other",
];
const Q_TEAM_SIZES = ["1-4", "5-19", "20-49", "50-199", "200-499", "500+"];
const Q_REVENUE = ["Pre-revenue", "Under 1M", "1M - 5M", "5M - 20M", "20M - 100M", "100M+"];
const Q_FUNDING = ["Bootstrapped", "Pre-seed / Seed", "Series A", "Series B", "Series C+", "Public"];
const Q_INDUSTRIES = [
  "E-commerce / Retail",
  "SaaS / Software",
  "Fintech",
  "Healthcare / HealthTech",
  "HR / People Ops / Recruiting",
  "Legal / LegalTech",
  "Marketing / Advertising",
  "Sales / RevOps",
  "Real Estate / PropTech",
  "Manufacturing",
  "Logistics / Supply Chain",
  "Education / EdTech",
  "Media / Entertainment",
  "Gaming",
  "Hospitality / Travel",
  "Food and Beverage / CPG",
  "Insurance / InsurTech",
  "Construction",
  "Energy / CleanTech",
  "Agriculture / AgTech",
  "Automotive / Mobility",
  "Telecom",
  "Nonprofit / Government",
  "Professional Services / Consulting",
  "Cybersecurity",
  "AI / ML / Data",
  "Developer Tools / Infra",
  "Biotech / Life Sciences",
  "Crypto / Web3",
  "Fitness / Wellness",
  "Beauty / Personal Care",
  "Fashion / Apparel",
  "Other",
];
const Q_APPLIES = [
  "We hire or pay people outside our country",
  "We ship physical products internationally",
  "We sell across multiple US states or countries",
  "We offer employee health benefits",
  "We have our own website or app codebase",
  "We have raised venture funding",
];

async function handleQualify(d, env, cors) {
  const dbId = env.NOTION_QUALIFY_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) {
    return json({ ok: false, error: "Qualify form not configured" }, 500, cors);
  }
  if (d._gotcha) return json({ ok: true }, 200, cors);            // honeypot: silently accept bots

  const name = String(d.name || "").trim();
  const email = String(d.email || "").trim();
  if (!name || !email) return json({ ok: false, error: "Missing name or email" }, 400, cors);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: "Invalid email" }, 400, cors);
  }

  const rich = (s) => {
    const v = String(s == null ? "" : s).trim();
    return v ? [{ text: { content: clip(v, 2000) } }] : [];
  };
  // Only ever write an option the database already has; an unexpected value is
  // dropped rather than silently creating a new select option.
  const pick = (value, allowed) => {
    const v = String(value == null ? "" : value).trim();
    return allowed.includes(v) ? { select: { name: v } } : null;
  };
  // The multi-select twin of pick(). Takes the array the form sends - and
  // degrades to a comma-separated string if anything ever posts one - keeps
  // only options the database already has, drops duplicates, and returns null
  // when nothing survives so the column is omitted rather than sent blank.
  const picks = (value, allowed) => {
    const list = Array.isArray(value) ? value : String(value == null ? "" : value).split(",");
    const names = [];
    for (const item of list) {
      const v = String(item == null ? "" : item).trim();
      if (allowed.includes(v) && names.indexOf(v) === -1) names.push(v);
    }
    return names.length ? { multi_select: names.map((name) => ({ name })) } : null;
  };
  const link = (s) => {
    const v = String(s || "").trim();
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  };

  const properties = {
    "Name": { title: rich(name) },
    "Email": { email: email },
  };
  // Notion rejects "" for a url property, so that column is only sent when
  // there is a real value to send.
  const linkedin = link(d.linkedin);
  if (linkedin) properties["LinkedIn"] = { url: linkedin };

  const member = pick(d.member, Q_MEMBER);
  if (member) properties["Time Rich member"] = member;
  const role = pick(d.role, Q_ROLES);
  if (role) properties["Your role"] = role;
  const teamSize = pick(d.team_size, Q_TEAM_SIZES);
  if (teamSize) properties["Team size"] = teamSize;
  const revenue = pick(d.revenue, Q_REVENUE);
  if (revenue) properties["Annual revenue"] = revenue;
  const funding = pick(d.funding, Q_FUNDING);
  if (funding) properties["Funding raised"] = funding;
  const usBased = pick(d.us_based, Q_US_BASED);
  if (usBased) properties["US-based company"] = usBased;
  const referrals = pick(d.referrals, Q_REFERRALS);
  if (referrals) properties["Network referrals"] = referrals;

  const industry = picks(d.industry, Q_INDUSTRIES);
  if (industry) properties["Your industry"] = industry;
  const applies = picks(d.applies, Q_APPLIES);
  if (applies) properties["Which of these apply"] = applies;

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    });
    if (!res.ok) return json({ ok: false, error: "Notion create failed", detail: await res.text() }, 502, cors);
    return json({ ok: true }, 200, cors);
  } catch (err) {
    return json({ ok: false, error: "Unexpected error", detail: String(err) }, 500, cors);
  }
}

// ---------------------------------------------------------------------------
// Cal.com booking webhook (POST /cal-webhook).
//
// Cal signs every delivery with HMAC-SHA256 over the RAW request body, keyed on
// the webhook's shared secret, and sends it hex-encoded in x-cal-signature-256.
// So this route reads request.text() (never request.json()) and verifies before
// it trusts a single field.
//
// Cal retries any non-2xx, and a retry would mean a duplicate Slack post - so
// once the signature checks out this ALWAYS answers 200, and the Notion/Slack
// work runs in ctx.waitUntil() so Cal never waits on our two upstreams.
// ---------------------------------------------------------------------------

// Booking triggers we act on. Anything else (FORM_SUBMITTED, MEETING_ENDED,
// BOOKING_REQUESTED, ...) is acknowledged and ignored.
const CAL_HANDLED = ["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"];

async function handleCalWebhook(request, env, cors, ctx) {
  if (!env.CAL_WEBHOOK_SECRET) {
    return json({ ok: false, error: "Cal webhook not configured" }, 500, cors);
  }

  const raw = await request.text();
  const ok = await verifyCalSignature(raw, request.headers.get("x-cal-signature-256"), env.CAL_WEBHOOK_SECRET);
  if (!ok) return json({ ok: false, error: "Invalid signature" }, 401, cors);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    // Signed but unparseable: 200 anyway, or Cal retries it forever.
    console.log("cal-webhook: signed body was not JSON");
    return json({ ok: true, ignored: "invalid json" }, 200, cors);
  }

  const trigger = String((body && body.triggerEvent) || "");
  if (!CAL_HANDLED.includes(trigger)) {
    return json({ ok: true, ignored: trigger || "unknown" }, 200, cors);
  }

  // processCalBooking never throws - it swallows Notion/Slack failures itself.
  const work = processCalBooking(trigger, (body && body.payload) || {}, env);
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work);
  else await work;

  return json({ ok: true }, 200, cors);
}

// Constant-time HMAC check. The header is 64 lowercase hex chars; anything that
// isn't that shape cannot be a valid signature, so it is rejected on shape alone
// (a format check leaks nothing about the secret).
async function verifyCalSignature(raw, header, secret) {
  const sig = String(header || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  let expected;
  try {
    expected = await calHmacHex(raw, secret);
  } catch (err) {
    console.log("cal-webhook: HMAC failed", String(err));
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

async function calHmacHex(raw, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The actual work: match the applicant in Notion, update them, tell Slack.
// Each half is isolated - Notion being down still gets the Slack post out, and
// a Slack failure still leaves the Notion update in place.
async function processCalBooking(trigger, p, env) {
  try {
    const attendee = (Array.isArray(p.attendees) && p.attendees[0]) || {};
    const responses = p.responses || {};
    const email = String(attendee.email || calResponse(responses.email) || "").trim();
    const name = String(attendee.name || calResponse(responses.name) || "").trim() || "Unknown";
    const timeZone = String(attendee.timeZone || "").trim();
    const start = String(p.startTime || "");
    const end = String(p.endTime || "");
    // Cal sends the old slot alongside the new startTime/endTime on a reschedule.
    const oldStart = String(p.rescheduleStartTime || "");
    const videoUrl = calVideoUrl(p);
    const reason = String(p.cancellationReason || "").trim();

    let page = null;
    let notionUp = true;
    try {
      page = email ? await findCalApplicant(env, email) : null;
    } catch (err) {
      notionUp = false;
      console.log("cal-webhook: Notion lookup failed", String(err));
    }

    if (page) {
      const properties = {};
      if (trigger === "BOOKING_CREATED") {
        properties["Status"] = { select: { name: "Call booked" } };
        if (start) properties["Call time"] = { date: { start } };
      } else if (trigger === "BOOKING_RESCHEDULED") {
        if (start) properties["Call time"] = { date: { start } };
      } else if (trigger === "BOOKING_CANCELLED") {
        properties["Status"] = { select: { name: "New" } };
        // Clear the slot too, or a cancelled application keeps showing up in the
        // "call today" views with a time nobody is going to turn up for.
        properties["Call time"] = { date: null };
      }
      if (Object.keys(properties).length) {
        try {
          await updateCalApplicant(env, page.id, properties);
        } catch (err) {
          notionUp = false;
          console.log("cal-webhook: Notion update failed", String(err));
        }
      }
    }

    const message = buildCalSlackMessage(trigger, {
      name, email, timeZone, start, end, oldStart, videoUrl, reason, page, notionUp,
    });
    try {
      await postCalSlack(env, message.blocks, message.text);
    } catch (err) {
      console.log("cal-webhook: Slack post failed", String(err));
    }
  } catch (err) {
    // Nothing in here may reject: it runs inside waitUntil().
    console.log("cal-webhook: unexpected error", String(err));
  }
}

// Find the applicant by Email. Notion's email filter is an exact match, so a
// lowercase retry covers a form entry that was typed with capitals.
async function findCalApplicant(env, email) {
  const dbId = env.NOTION_SUPERHUMAN_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) return null;

  const tries = [email];
  if (email.toLowerCase() !== email) tries.push(email.toLowerCase());
  for (const value of tries) {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ filter: { property: "Email", email: { equals: value } }, page_size: 1 }),
    });
    if (!res.ok) throw new Error("Notion query " + res.status + ": " + (await res.text()));
    const data = await res.json();
    const hit = (data.results || [])[0];
    if (hit) return hit;
  }
  return null;
}

async function updateCalApplicant(env, pageId, properties) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error("Notion update " + res.status + ": " + (await res.text()));
  return true;
}

// Slack answers 200 with { ok: false, error } on a rejected post, so the body
// matters as much as the status.
async function postCalSlack(env, blocks, text) {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_CHANNEL_ID) {
    console.log("cal-webhook: Slack not configured, skipping post");
    return false;
  }
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: env.SLACK_CHANNEL_ID, text, blocks, unfurl_links: false }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON body: fall through to the status */ }
  if (!res.ok || data.ok === false) {
    throw new Error("Slack " + res.status + ": " + (data.error || "unknown"));
  }
  return true;
}

// One section block of mrkdwn - compact, and it reads the same in a channel, a
// thread and a mobile notification.
function buildCalSlackMessage(trigger, d) {
  const lines = [];
  let headline;

  if (trigger === "BOOKING_CREATED") {
    headline = `📞 *Call booked* — ${calEsc(d.name)}`;
    lines.push(headline);
    lines.push(`*Email:* ${calEsc(d.email) || "—"}`);
    lines.push(`*When:*\n${calBothZones(d.start, d.end)}`);
    if (d.timeZone) lines.push(`*Their timezone:* ${calEsc(d.timeZone)}`);
    if (d.videoUrl) lines.push(`*Video:* ${calEsc(d.videoUrl)}`);
  } else if (trigger === "BOOKING_RESCHEDULED") {
    headline = `🔄 *Call rescheduled* — ${calEsc(d.name)}`;
    lines.push(headline);
    lines.push(`*Email:* ${calEsc(d.email) || "—"}`);
    if (d.oldStart) {
      lines.push(`*Was:*\n${calBothZones(d.oldStart)}`);
      lines.push(`*Now:*\n${calBothZones(d.start, d.end)}`);
    } else {
      lines.push(`*New time:*\n${calBothZones(d.start, d.end)}`);
    }
  } else {
    headline = `❌ *Call cancelled* — ${calEsc(d.name)}`;
    lines.push(headline);
    lines.push(`*Email:* ${calEsc(d.email) || "—"}`);
    if (d.start) lines.push(`*Was:*\n${calBothZones(d.start)}`);
    if (d.reason) lines.push(`*Reason:* ${calEsc(d.reason)}`);
    lines.push("_Status set back to New — they can rebook._");
  }

  // The full breakdown only rides along with a new booking; a reschedule or a
  // cancellation is a one-line nudge about a person the channel already knows.
  if (trigger === "BOOKING_CREATED" && d.page) {
    const props = d.page.properties || {};
    const extras = [
      ["Business", calProp(props["Business"])],
      ["Department", calProp(props["Department"])],
      ["Outcome", calProp(props["Outcome"])],
      ["Track", calProp(props["Track preference"])],
      ["1:1 coaching", calProp(props["1:1 coaching"])],
      ["Phone", calProp(props["Phone"])],
      ["LinkedIn", calProp(props["LinkedIn"]) || calProp(props["Website"])],
    ].filter((pair) => pair[1]);
    if (extras.length) {
      lines.push("");
      for (const [label, value] of extras) lines.push(`*${label}:* ${calEsc(clip(value, 500))}`);
    }
    if (d.page.url) lines.push(`<${d.page.url}|Open the application in Notion>`);
  }

  if (!d.page) {
    lines.push(d.notionUp
      ? "⚠️ no application found for this email"
      : "⚠️ no application found for this email (Notion lookup failed)");
  }

  return {
    text: headline.replace(/\*/g, ""),
    blocks: [{ type: "section", text: { type: "mrkdwn", text: clip(lines.join("\n"), 2900) } }],
  };
}

// The same slot in both timezones, so nobody has to do the arithmetic. The end
// time is appended as a bare clock time (same day, same zone) when we have it.
//
// Each zone is formatted in its OWN locale on purpose: en-US renders New York
// as "EDT" but Lisbon as "GMT+1", and en-GB does the reverse ("WEST", "GMT-4").
// Formatting each side the way that side writes it is what makes the two lines
// unambiguous, which is the whole reason for printing both.
const CAL_ZONES = [
  { label: "New York", timeZone: "America/New_York", locale: "en-US" },
  { label: "Lisbon", timeZone: "Europe/Lisbon", locale: "en-GB" },
];

function calBothZones(iso, endIso) {
  if (!iso) return "—";
  return CAL_ZONES.map((z) => {
    const until = endIso ? ` → ${calZone(endIso, z, true)}` : "";
    return `• ${z.label} — ${calZone(iso, z)}${until}`;
  }).join("\n");
}
function calZone(iso, zone, clockOnly) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const opts = clockOnly
    ? { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone.timeZone }
    : {
        weekday: "short", day: "numeric", month: "short",
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: zone.timeZone, timeZoneName: "short",
      };
  try {
    return new Intl.DateTimeFormat(zone.locale, opts).format(d);
  } catch {
    return d.toISOString();
  }
}

// Cal's booking-form answers: usually { label, value }, but "value" can itself
// be a { firstName, lastName } object on a split name field.
function calResponse(field) {
  if (!field) return "";
  const v = field && typeof field === "object" && "value" in field ? field.value : field;
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return [v.firstName, v.lastName].filter(Boolean).join(" ").trim();
  return String(v);
}

// Cal reports the meeting link in three different places depending on the
// location the event type uses.
function calVideoUrl(p) {
  const meta = (p.metadata && p.metadata.videoCallUrl) || "";
  const data = (p.videoCallData && p.videoCallData.url) || "";
  const loc = typeof p.location === "string" && /^https?:\/\//i.test(p.location) ? p.location : "";
  return String(meta || data || loc || "");
}

// Read any Notion property type down to a plain string for the Slack summary.
function calProp(prop) {
  if (!prop) return "";
  const plain = (arr) => (arr || []).map((t) => t.plain_text || (t.text && t.text.content) || "").join("").trim();
  switch (prop.type) {
    case "title": return plain(prop.title);
    case "rich_text": return plain(prop.rich_text);
    case "select": return (prop.select && prop.select.name) || "";
    case "multi_select": return (prop.multi_select || []).map((o) => o.name).join(", ");
    case "status": return (prop.status && prop.status.name) || "";
    case "email": return prop.email || "";
    case "phone_number": return prop.phone_number || "";
    case "url": return prop.url || "";
    case "date": return (prop.date && prop.date.start) || "";
    case "number": return prop.number == null ? "" : String(prop.number);
    case "checkbox": return prop.checkbox ? "Yes" : "No";
    default: return "";
  }
}

// Slack mrkdwn reserves these three, and everything interpolated above is data
// that came in over the webhook.
function calEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || "*")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  let allow = allowed[0] || "*";
  if (allowed.includes("*")) {
    allow = "*";
  } else {
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (allowed.includes(origin) || isLocal) allow = origin;
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function authHeaders(env) {
  return { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION };
}
function buildProp(type, value) {
  switch (type) {
    case "email": return { email: value };
    case "phone_number": return { phone_number: value };
    case "url": return { url: /^https?:\/\//i.test(value) ? value : `https://${value}` };
    case "select": return { select: { name: clip(value, 100) } };
    case "multi_select":
      return {
        multi_select: value.split(",").map((s) => ({ name: clip(s.trim(), 100) })).filter((o) => o.name),
      };
    case "number": {
      const n = parseFloat(value.replace(/[^0-9.\-]/g, ""));
      return { number: isNaN(n) ? null : n };
    }
    case "checkbox": return { checkbox: /^(yes|true|1)$/i.test(value) };
    case "rich_text":
    default: return { rich_text: [{ text: { content: clip(value, 2000) } }] };
  }
}
function paragraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ text: { content: clip(text, 2000) } }] },
  };
}
function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n) : s; }
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
