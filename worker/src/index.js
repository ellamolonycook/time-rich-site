// Time Rich — application intake Worker.
// Receives the JSON the website form sends and creates a page (row) in a Notion
// database. It reads your database schema first, so it only writes to columns
// that actually exist — and it always writes the full submission into the page
// body, so nothing is ever lost even if a column is missing.

const NOTION_VERSION = "2022-06-28";

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    // Route: LinkedIn autofill enrichment.
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (path.endsWith("/enrich")) {
      return handleEnrich(request, env, cors);
    }

    // Otherwise: application submission -> Notion.
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

// LinkedIn autofill via Proxycurl. Returns { configured, ok, fields, photo_url }.
async function handleEnrich(request, env, cors) {
  if (!env.PROXYCURL_KEY) {
    return json({ configured: false }, 200, cors); // feature not turned on yet
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }
  const url = String(body.linkedin_url || "").trim();
  if (!/linkedin\.com\/in\//i.test(url)) {
    return json({ configured: true, ok: false, error: "Not a LinkedIn profile URL" }, 200, cors);
  }

  const api =
    "https://nubela.co/proxycurl/api/v2/linkedin" +
    "?use_cache=if-present&fallback_to_cache=on-error&url=" +
    encodeURIComponent(url);

  const r = await fetch(api, { headers: { Authorization: `Bearer ${env.PROXYCURL_KEY}` } });
  if (!r.ok) {
    return json({ configured: true, ok: false, error: "Lookup failed", detail: await r.text() }, 200, cors);
  }
  const p = await r.json();
  const exp = (p.experiences && p.experiences[0]) || {};
  const city = [p.city, p.country_full_name].filter(Boolean).join(", ");
  const fields = {
    name: p.full_name || "",
    title: exp.title || p.occupation || p.headline || "",
    company: exp.company || "",
    city: city,
    bio: p.headline || "",
  };
  return json({ configured: true, ok: true, fields, photo_url: p.profile_pic_url || "" }, 200, cors);
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
