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
  async fetch(request, env) {
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
