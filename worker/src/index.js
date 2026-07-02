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

    // Application submission -> Notion.
    if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
      return json({ error: "Server not configured" }, 500, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    // Anti-spam: silently accept bot submissions (honeypot field filled in).
    if (data._gotcha) return json({ ok: true }, 200, cors);
    if (!data["Email"] && !data.email) {
      return json({ error: "Email is required" }, 400, cors);
    }

    try {
      // 1) Read the database schema to learn property names + types.
      const dbRes = await fetch(
        `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}`,
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
          parent: { database_id: env.NOTION_DATABASE_ID },
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
  },
};

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
