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
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    // This is an administrator-only endpoint. It deliberately has no CORS
    // headers: it is triggered manually with a bearer token, not by a page in
    // a member's browser.
    if (path.endsWith("/portal-passcode-emails")) {
      return handlePortalPasscodeEmails(request, env);
    }

    const cors = corsHeaders(request, env);

    // This one route answers its own preflight, because it is locked to a
    // single origin rather than the Worker-wide ALLOWED_ORIGIN list.
    // Same for Time Rich Members, which the portal calls from timerich.ai only.
    if (request.method === "OPTIONS" &&
        /\/portal-(download|directory|login|session|logout)$/
          .test(new URL(request.url).pathname.replace(/\/+$/, ""))) {
      return new Response(null, { status: 204, headers: portalDownloadCors(request) });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // ThriveCart pings a webhook URL with HEAD before it accepts the setup.
    if (path.endsWith("/thrivecart-webhook") && request.method === "HEAD") {
      return new Response(null, { status: 204, headers: cors });
    }

    // ThriveCart also validates the URL with a GET before it will save the
    // webhook. Answer 200 with nothing but an ack: no config, no secrets, and
    // no order data - the POST handler below still does the real work and
    // still checks the shared secret.
    if (path.endsWith("/thrivecart-webhook") && request.method === "GET") {
      return json({ ok: true }, 200, cors);
    }

    // Route: Onboard lookup (GET /onboard?tracking_id=... or ?email=...)
    if (path.endsWith("/onboard") && request.method === "GET") {
      return handleOnboardVerification(request, env, cors, url);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    // Route: portal sign-in (POST /portal-login). Email in, session token
    // out. Rate limited per IP, which is why it lives here rather than
    // being an RPC the browser calls straight from the page.
    if (path.endsWith("/portal-login")) {
      return handlePortalLogin(request, env);
    }

    // Route: read the portal with a session token (POST /portal-session).
    if (path.endsWith("/portal-session")) {
      return handlePortalSession(request, env);
    }

    // Route: forget one browser's session (POST /portal-logout).
    if (path.endsWith("/portal-logout")) {
      return handlePortalLogout(request, env);
    }

    // Route: gated Superhuman skill download (POST /portal-download)
    if (path.endsWith("/portal-download")) {
      return handlePortalDownload(request, env);
    }

    // Route: Time Rich Members backfill (POST /portal-directory-sync). Team
    // only, behind DIRECTORY_SYNC_SECRET; copies every questionnaire row into
    // portal_directory.
    if (path.endsWith("/portal-directory-sync")) {
      return handleDirectoryBackfill(request, env, cors);
    }

    // Route: Time Rich Members read (POST /portal-directory). The portal page
    // sends the member's passcode and gets the profiles back.
    if (path.endsWith("/portal-directory")) {
      return handlePortalDirectory(request, env);
    }

    // Route: ThriveCart purchase webhook (handles order.success, order.subscription_payment, order.refund)
    if (path.endsWith("/thrivecart-webhook")) {
      return handleThriveCartWebhook(request, env, cors, ctx);
    }

    // Route: Onboard form submit (POST /onboard)
    if (path.endsWith("/onboard")) {
      let onboardData;
      try { onboardData = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }
      return handleOnboardSubmit(onboardData, env, cors, ctx);
    }

    // Route: buyer questionnaire (POST /onboard-questionnaire). Lands on the
    // same Notion row as /onboard. Unlike the rest of the writes here this one
    // is awaited, because the page has to be able to say it did not save.
    if (path.endsWith("/onboard-questionnaire")) {
      let questionnaireData;
      try { questionnaireData = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }
      return handleOnboardQuestionnaire(questionnaireData, env, cors, ctx);
    }

    // Route: the standalone questionnaire at /superhuman/ (POST
    // /superhuman-questionnaire). Open to buyers, second seats and
    // ambassadors, so there is no order lookup: the form says who it is and
    // the email is the key. Awaited, like /onboard-questionnaire, because the
    // page has to be able to say it did not save.
    //
    // This path does not end with "/superhuman", so the legacy /sh-apply
    // route further down is unaffected.
    if (path.endsWith("/superhuman-questionnaire")) {
      let shqData;
      try { shqData = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }
      return handleSuperhumanQuestionnaire(shqData, env, cors, ctx);
    }

    // Route: corner chatbot -> Anthropic.
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

    // Route: Superhuman Accelerator pre-checkout capture.
    if (path.endsWith("/join")) {
      const firstName = String(data.firstName || data.first_name || "").trim();
      const email = String(data.email || "").trim();
      const superhumanAnswer = String(
        data.superhumanAnswer || data.superhuman_answer || ""
      ).trim();

      if (!firstName || !email || !superhumanAnswer) {
        return json(
          { error: "First name, email, and superhuman answer are required" },
          400,
          cors
        );
      }

      const trackingId = String(data.trackingId || data.tracking_id || crypto.randomUUID()).trim();

      const submission = {
        Name: firstName,
        Email: email,
        "Superhuman Answer": superhumanAnswer,
        TrackingID: trackingId,
        "Payment Status": "Pending",
      };

      const notionPromise = createApplication(
        submission,
        env,
        cors,
        env.NOTION_SUPERHUMAN_COHORT1_DATABASE_ID
      );

      // Hot-lead alert. Fire-and-forget: notifyJoinSlack swallows its own
      // errors, so neither the Notion write nor this response can be affected.
      const slackPromise = notifyJoinSlack(env, { firstName, email, superhumanAnswer, trackingId });
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(slackPromise);
      }

      // Append row to Intent tab of Google Sheet (Never block on this)
      const intentSheetUrl = env.GOOGLE_SHEET_INTENT_URL || env.GOOGLE_SHEET_WEBHOOK_URL;
      if (intentSheetUrl) {
        const sheetPromise = fetch(intentSheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tab: "Intent",
            timestamp: new Date().toISOString(),
            firstName,
            email,
            superhumanAnswer,
            trackingId,
            paymentStatus: "Pending",
          }),
        }).catch((err) => console.error("Google Sheet Intent append error:", err));

        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(sheetPromise);
        }
      }

      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(notionPromise);
      } else {
        await notionPromise.catch((err) => console.error("Notion error:", err));
      }

      return json(
        {
          ok: true,
          trackingId,
        },
        200,
        cors
      );
    }

    // Route: Super Human Accelerator application -> its own Notion database.
    // This is the /sh-apply application form, NOT the questionnaire; the
    // questionnaire is /superhuman-questionnaire above.
    if (path.endsWith("/superhuman")) {
      // The rebuilt /sh-apply form (eight questions, one at a time) posts a
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
      return handleQualify(data, env, cors, ctx);
    }

    // Route: strategy intake (/strategy) -> the "Client Intake Form" database.
    // Twenty-one written answers, mapped property-by-property below: every
    // column on that database is plain text, and its names are the questions
    // themselves, so the mapping table is the contract with the page.
    if (path.endsWith("/strategy")) {
      return handleStrategy(data, env, cors, ctx);
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
// booking webhook / player events), Track preference (the six-or-ten-weeks
// question is gone from the form; the column is left in place, unwritten), or
// any of the old form's columns.
const SH_DEPARTMENTS = [
  "Sales",
  "Marketing & content",
  "Delivery / client success",
  "Operations & admin",
  "Finance",
  "Hiring & team",
  "Not sure yet",
];
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

  // Department takes several answers, so it is a Notion multi_select. Values are
  // filtered against the known list for the same reason pick() does it — an
  // unexpected one is dropped rather than silently creating a new option — and
  // deduped, because Notion rejects a multi_select carrying the same name twice.
  const departments = [...new Set(
    (Array.isArray(d.department) ? d.department : [d.department])
      .map((v) => String(v == null ? "" : v).trim())
      .filter((v) => SH_DEPARTMENTS.includes(v))
  )];
  if (departments.length) {
    properties["Department"] = { multi_select: departments.map((name) => ({ name })) };
  }
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
const Q_TEAM_SIZES = [
  "Self employed",
  "1-2",
  "3-5",
  "5-10",
  "10-20",
  "20-50",
  "50-100",
  "100+",
  "I work for a company with 100+",
];
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

async function handleQualify(d, env, cors, ctx) {
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

    // Notion answers with the page it made, url included. The row exists
    // whether or not this parses, so a bad body must not turn a success into
    // an error - the link is simply left off the Slack post.
    let notionUrl = null;
    try { notionUrl = (await res.json()).url || null; } catch { }

    // The row is in. Tell the channel - in the background, so a slow or broken
    // Slack can neither delay nor fail the submission. notifyQualifySlack()
    // never rejects; it logs and swallows.
    const heads = notifyQualifySlack(env, {
      name, email, linkedin,
      role: role && role.select.name,
      teamSize: teamSize && teamSize.select.name,
      revenue: revenue && revenue.select.name,
      funding: funding && funding.select.name,
      usBased: usBased && usBased.select.name,
      industry: industry && industry.multi_select.map((o) => o.name).join(", "),
      notionUrl,
    });
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(heads);

    return json({ ok: true }, 200, cors);
  } catch (err) {
    return json({ ok: false, error: "Unexpected error", detail: String(err) }, 500, cors);
  }
}

// One compact block per qualify submission, posted to an incoming webhook.
// Only the values that were actually written to Notion are shown, so what the
// channel sees is what the row says. Anything that goes wrong in here is logged
// and swallowed: the form has already succeeded by the time this runs, and this
// must never be the reason it looks like it did not. The webhook URL is a
// secret and is never logged - not even inside an error message.
async function notifyQualifySlack(env, s) {
  const url = env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.log("qualify: SLACK_WEBHOOK_URL not set, skipping Slack post");
    return;
  }
  // Everything from here down is inside one try: building the message is as
  // capable of throwing on a strange value as sending it is, and neither may
  // surface.
  try {
    const or = (v) => (v ? calEsc(v) : "—");
    // A bare URL can carry the three characters mrkdwn reserves for links.
    const safeUrl = (u) => String(u || "").replace(/[<>|]/g, "");
    const li = s.linkedin
      ? `<${safeUrl(s.linkedin)}|${calEsc(s.linkedin.replace(/^https?:\/\/(www\.)?/i, ""))}>`
      : "—";

    const text = `New qualify submission — ${s.name} (${s.role || "role not given"}, ${s.teamSize || "team size not given"})`;
    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: `📝 *New qualify submission* — *${calEsc(s.name)}*` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Role*\n${or(s.role)}` },
          { type: "mrkdwn", text: `*Team size*\n${or(s.teamSize)}` },
          { type: "mrkdwn", text: `*Annual revenue*\n${or(s.revenue)}` },
          { type: "mrkdwn", text: `*Funding raised*\n${or(s.funding)}` },
          { type: "mrkdwn", text: `*US-based*\n${or(s.usBased)}` },
          { type: "mrkdwn", text: `*Industry*\n${or(s.industry)}` },
          { type: "mrkdwn", text: `*Email*\n${or(s.email)}` },
        ],
      },
      { type: "context", elements: [{ type: "mrkdwn", text: `*LinkedIn:* ${li}` }] },
      // Straight to the row, so whoever is reading the channel can act on it.
      {
        type: "context", elements: [{
          type: "mrkdwn", text: s.notionUrl
            ? `<${safeUrl(s.notionUrl)}|Open in Notion →>`
            : "_Notion link unavailable_"
        }]
      },
    ];

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks, unfurl_links: false }),
    });
    // Webhooks answer a plain "ok"; anything else is a rejection worth seeing.
    if (!res.ok) console.log("qualify: Slack post failed", res.status, clip(await res.text(), 200));
  } catch (err) {
    // A network error can quote the URL it was trying to reach - redact it.
    console.log("qualify: Slack post failed", String((err && err.message) || err).split(url).join("[webhook]"));
  }
}

// Strategy intake (/strategy) -> the "Client Intake Form" database.
//
// The eighteen questions ARE the column names on that database, numbering and
// punctuation included, so this table is the whole mapping: the left side is
// what /strategy/ posts, the right side is the Notion property, character for
// character. A typo here is a silently dropped answer - Notion ignores a
// property it does not recognise rather than complaining - so if the questions
// are ever reworded in Notion, they have to be reworded here and on the page
// in the same change.
const STRATEGY_QUESTIONS = [
  ["q01", "01. What made you want to bring in operational help now?"],
  ["q02", "02. Looking ahead, what does the business look like if this works?"],
  ["q03", "03. What would make this a clear win in the first 30 days?"],
  ["q04", "04. What would make this a clear win in the first 90 days?"],
  ["q05", "05. What would make this a clear win in the first 6 months?"],
  ["q06", "06. Which tasks eat the most hours each week, and who does them?"],
  ["q07", "07. Walk us through the last time something broke or slipped. What happened?"],
  ["q08", "08. Where are you losing money or leaving it on the table?"],
  ["q09", "09. If you could hand off one job tomorrow, what would it be?"],
  ["q10", "10. List every tool the team uses and what each does."],
  ["q11", "11. Where are you using AI today, and who uses it? What has worked and what has not?"],
  ["q12", "12. Where do tools fail to talk to each other, so someone copies data by hand?"],
  ["q13", "13. What would you budget for a full-time COO or operations lead hire?"],
  ["q14", "14. What monthly budget do you have for fractional COO and AI systems support?"],
  ["q15", "15. What outcomes must be hit for this to pay for itself?"],
  ["q16", "16. Which one fix would give the company the biggest return, and why?"],
  ["q17", "17. Who signs off on spend, and how do you want to make the decision?"],
  ["q18", "18. What should we know that did not come up on the call?"],
];

// ---------------------------------------------------------------------------
// Slack ping for a saved strategy intake.
//
// Posts with the bot token to SLACK_STRATEGY_CHANNEL_ID. Both are secrets:
// neither is logged, and a failure is never surfaced to the person who filled
// the form. Fire-and-forget through ctx.waitUntil, after the Notion row exists.
// ---------------------------------------------------------------------------

const STRATEGY_WIN_CHARS = 200;

function strategySlackText(fields) {
  const esc = slackEscape;
  const lines = [];

  lines.push(
    `*New strategy intake: ${esc(fields.name)}*` +
    (fields.role ? ` (${esc(fields.role)})` : "")
  );
  if (fields.email) lines.push(esc(fields.email));

  const win = String(fields.win30 == null ? "" : fields.win30).trim();
  if (win) lines.push(`Win in 30 days: ${esc(clip(win, STRATEGY_WIN_CHARS))}`);

  const budget = String(fields.budget == null ? "" : fields.budget).trim();
  if (budget) lines.push(`Budget (monthly): ${esc(budget)}`);

  if (fields.pageUrl) lines.push(`<${esc(fields.pageUrl)}|Open in Notion>`);

  return lines.join("\n");
}

function notifySlackStrategy(env, ctx, fields) {
  const channel = env && env.SLACK_STRATEGY_CHANNEL_ID;
  if (!env || !env.SLACK_BOT_TOKEN || !channel) return;   // not configured: skip

  const work = postSlackMessage(env, undefined, strategySlackText(fields), channel)
    .then(
      () => {},
      () => {
        // A fixed string only. The error carries the Slack response and the
        // token lives one object away, so neither goes near a log line.
        console.error("[STRATEGY] slack post failed");
      }
    );

  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work);
}

async function handleStrategy(d, env, cors, ctx) {
  const dbId = env.NOTION_STRATEGY_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) {
    return json({ ok: false, error: "Strategy form not configured" }, 500, cors);
  }
  if (d._gotcha) return json({ ok: true }, 200, cors);            // honeypot: silently accept bots

  const name = String(d.name || "").trim();
  const email = String(d.email || "").trim();
  if (!name || !email) return json({ ok: false, error: "Missing name or email" }, 400, cors);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: "Invalid email" }, 400, cors);
  }

  // One rich-text run, trimmed, and cut to Notion's 2,000-character ceiling for
  // a single text property. The page holds the same line in the field itself,
  // so this only ever fires on something that bypassed it.
  const rich = (s) => {
    const v = String(s == null ? "" : s).trim();
    return v ? [{ text: { content: clip(v, 2000) } }] : [];
  };

  const properties = {
    "Your name": { title: rich(name) },
    "Email": { email: email },
    "Your role": { rich_text: rich(d.role) },
  };
  // An unanswered question is written as an empty column rather than left out:
  // every row then has the same shape, and a blank says "they were asked and
  // skipped it", which is worth knowing before the call.
  for (const [key, property] of STRATEGY_QUESTIONS) {
    properties[property] = { rich_text: rich(d[key]) };
  }

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    });
    if (!res.ok) return json({ ok: false, error: "Notion create failed", detail: await res.text() }, 502, cors);

    // The row is saved. Only now is Slack told, and only through waitUntil, so
    // a Slack outage can never turn a saved intake into an error for the form.
    let page = null;
    try { page = await res.json(); } catch { /* saved; only the link is lost */ }
    notifySlackStrategy(env, ctx, {
      name: name,
      email: email,
      role: d.role,
      win30: d.q03,
      budget: d.q14,
      pageUrl: page && typeof page.url === "string" ? page.url : "",
    });
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
      await postSlackMessage(env, message.blocks, message.text);
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

// Pre-checkout form (POST /join): whoever fills this in is a hot lead whether
// or not they go on to pay, so it posts on submission and never again. The
// channel is configurable; this id is only the fallback.
const HOTLEADS_CHANNEL_FALLBACK = "C0C4S1A48SC";

// Every question the join modal asks, with the payload key its answer arrives
// under, so the Slack message reads like the form the person filled in.
const JOIN_QUESTIONS = [
  ["What is your first name?", "firstName"],
  ["What is your best email address?", "email"],
  ["What will make you become superhuman?", "superhumanAnswer"],
];

function buildJoinSlackMessage(answers) {
  const lines = ["*New pre-checkout form* \u2014 not paid yet"];
  for (const [question, key] of JOIN_QUESTIONS) {
    lines.push("*" + calEsc(question) + "*\n" + (answers[key] ? calEsc(answers[key]) : "\u2014"));
  }
  lines.push("*Tracking ID*\n`" + calEsc(answers.trackingId || "\u2014") + "`");
  return {
    text: "New pre-checkout form: " + (answers.firstName || "someone") + " (" + (answers.email || "no email") + ")",
    blocks: [{ type: "section", text: { type: "mrkdwn", text: clip(lines.join("\n\n"), 2900) } }],
  };
}

// Nothing in here may reject or throw: it runs alongside the Notion write and
// must never be the reason a submission looks like it failed.
async function notifyJoinSlack(env, answers) {
  try {
    const channel = env.SLACK_HOTLEADS_CHANNEL_ID || HOTLEADS_CHANNEL_FALLBACK;
    const message = buildJoinSlackMessage(answers);
    console.log("[JOIN] slack: posting", JSON.stringify({ channel, email: answers.email || null, trackingId: answers.trackingId || null }));
    await postSlackMessage(env, message.blocks, message.text, channel);
    console.log("[JOIN] slack: posted OK");
  } catch (err) {
    console.log("[JOIN] slack: post FAILED", err && err.message ? err.message : String(err));
  }
}

// Slack answers 200 with { ok: false, error } on a rejected post, so the body
// matters as much as the status. `channel` is optional and defaults to the
// booking-alerts channel, so existing callers are unchanged.
async function postSlackMessage(env, blocks, text, channel) {
  const target = channel || env.SLACK_CHANNEL_ID;
  if (!env.SLACK_BOT_TOKEN || !target) {
    console.log("slack: not configured, skipping post");
    return false;
  }
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: target, text, blocks, unfurl_links: false }),
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

// ---------------------------------------------------------------------------
// Gated Superhuman skill downloads.
//
// POST /portal-download  {code, item_id}  ->  {url}
//
// The reply is a Storage signed URL good for five minutes. Everything else
// is a flat 403 with no detail: a wrong code, a locked week, an unknown or
// non-skill item and a missing file all look identical from outside, so the
// endpoint cannot be used to probe what exists.
//
// The passcode is never logged, never echoed and never put in a URL.
// ---------------------------------------------------------------------------

const PORTAL_DOWNLOAD_ORIGIN = "https://timerich.ai";

// The local dev server, so the portal can be opened from a checkout while
// working on it. Exactly these two, http only, and only on port 8000: the
// production origin above is unchanged, and the Worker-wide ALLOWED_ORIGIN
// list that every other route uses is not touched by any of this.
const PORTAL_LOCAL_ORIGINS = [
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];
const SKILL_BUCKET = "portal-skills";
const SKILL_URL_TTL_SECONDS = 300; // 5 minutes

// Deliberately not the Worker-wide corsHeaders(): that one honours
// ALLOWED_ORIGIN, which can be "*". This route answers the portal only.
function portalDownloadCors(request) {
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  // Echoed back to the one caller that asked, never widened to a wildcard.
  const origin = request.headers.get("Origin") || "";
  if (origin === PORTAL_DOWNLOAD_ORIGIN || PORTAL_LOCAL_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/* ---- portal sign-in --------------------------------------------------
 *
 * A member types their email address and nothing else. If it matches an
 * active portal_members row, Supabase mints a 30 day session token and
 * the browser keeps that, not the address.
 *
 * The answer for an unknown address and for a deactivated member is the
 * same 404 with the same wording, so this cannot be used to find out who
 * has access.
 *
 * SECURITY NOTE, recorded here because it is a deliberate trade-off and
 * not an oversight: an email address is not a secret. Anyone who knows a
 * member's address can sign in as them. If that becomes a problem, mail a
 * one-time link to the address and only call portal_login when the link
 * is opened; nothing else here has to change.
 */
const PORTAL_LOGIN_WINDOW_SECONDS = 10 * 60;   // 10 minutes
const PORTAL_LOGIN_MAX_ATTEMPTS = 10;          // per IP, per window
const PORTAL_LOGIN_NOT_FOUND =
  "We couldn't find that email. Use the email you joined with, or contact emc@timerich.ai.";

function portalLoginIp(request) {
  return request.headers.get("CF-Connecting-IP")
      || request.headers.get("X-Forwarded-For")
      || "unknown";
}

/* A counter per IP per window, in KV.
 *
 * Returns true when the caller is over the limit. If PORTAL_LOGIN_RL is not
 * bound the attempt is allowed: a missing namespace must not lock every
 * member out. See worker/wrangler.toml for the binding, which has to exist
 * for this limit to do anything at all.
 */
async function portalLoginRateLimited(request, env) {
  const kv = env.PORTAL_LOGIN_RL;
  if (!kv || typeof kv.get !== "function") return false;

  const window = Math.floor(Date.now() / 1000 / PORTAL_LOGIN_WINDOW_SECONDS);
  const key = `portal-login:${portalLoginIp(request)}:${window}`;

  let count = 0;
  try {
    count = Number(await kv.get(key)) || 0;
  } catch {
    return false;                       // KV unreadable: do not lock anyone out
  }
  if (count >= PORTAL_LOGIN_MAX_ATTEMPTS) return true;

  try {
    // The TTL is the window plus a minute, so the key clears itself.
    await kv.put(key, String(count + 1), { expirationTtl: PORTAL_LOGIN_WINDOW_SECONDS + 60 });
  } catch {
    /* the attempt still goes through; it just is not counted */
  }
  return false;
}

async function handlePortalLogin(request, env) {
  const cors = portalDownloadCors(request);

  const sb = supabaseService(env);
  if (!sb) return json({ ok: false, error: "unavailable" }, 503, cors);

  if (await portalLoginRateLimited(request, env)) {
    return json(
      { ok: false, error: "rate_limited", message: "Too many attempts. Try again in a few minutes." },
      429,
      cors
    );
  }

  let body;
  try { body = await request.json(); } catch { body = null; }

  // Trimmed and lowercased here as well as in Postgres, so a malformed
  // address never reaches the database.
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) {
    return json({ ok: false, error: "not_found", message: PORTAL_LOGIN_NOT_FOUND }, 404, cors);
  }

  let payload;
  try {
    const res = await fetch(`${sb.base}/rest/v1/rpc/portal_login`, {
      method: "POST",
      headers: sb.headers,
      body: JSON.stringify({ p_email: email }),
    });
    if (!res.ok) return json({ ok: false, error: "unavailable" }, 503, cors);
    payload = await res.json();
  } catch {
    return json({ ok: false, error: "unavailable" }, 503, cors);
  }

  // An unknown address and an inactive member answer identically.
  if (!payload || payload.ok !== true || typeof payload.token !== "string" || !payload.token) {
    return json({ ok: false, error: "not_found", message: PORTAL_LOGIN_NOT_FOUND }, 404, cors);
  }

  return json(payload, 200, cors);
}

/* The portal's own pages call this on every load with the token they were
 * given at sign-in. Same payload portal_get returns. */
async function handlePortalSession(request, env) {
  const cors = portalDownloadCors(request);

  const sb = supabaseService(env);
  if (!sb) return json({ ok: false, error: "unavailable" }, 503, cors);

  let body;
  try { body = await request.json(); } catch { body = null; }
  const token = String(body?.token ?? "").trim();
  if (!token) return json({ ok: false }, 401, cors);

  let payload;
  try {
    const res = await fetch(`${sb.base}/rest/v1/rpc/portal_get_by_token`, {
      method: "POST",
      headers: sb.headers,
      body: JSON.stringify({ p_token: token }),
    });
    if (!res.ok) return json({ ok: false, error: "unavailable" }, 503, cors);
    payload = await res.json();
  } catch {
    return json({ ok: false, error: "unavailable" }, 503, cors);
  }

  if (!payload || payload.ok !== true) return json({ ok: false }, 401, cors);
  return json(payload, 200, cors);
}

async function handlePortalLogout(request, env) {
  const cors = portalDownloadCors(request);

  const sb = supabaseService(env);
  // Signing out must always look like it worked, even with no database.
  if (!sb) return json({ ok: true }, 200, cors);

  let body;
  try { body = await request.json(); } catch { body = null; }
  const token = String(body?.token ?? "").trim();
  if (!token) return json({ ok: true }, 200, cors);

  try {
    await fetch(`${sb.base}/rest/v1/rpc/portal_logout`, {
      method: "POST",
      headers: sb.headers,
      body: JSON.stringify({ p_token: token }),
    });
  } catch {
    /* the browser forgets the token regardless */
  }
  return json({ ok: true }, 200, cors);
}

/* Both gated portal routes used to take the passcode. They now take the
 * session token, and fall back to a passcode so anything still holding one
 * keeps working. Returns the member payload, or null. */
async function portalPayloadFromBody(sb, body) {
  const token = String(body?.token ?? "").trim();
  const code = String(body?.code ?? "").trim();

  const call = async (fn, args) => {
    const res = await fetch(`${sb.base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: sb.headers,
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload && payload.ok === true ? payload : null;
  };

  if (token) return call("portal_get_by_token", { p_token: token });
  if (code) return call("portal_get", { p_code: code });
  return null;
}

async function handlePortalDownload(request, env) {
  const cors = portalDownloadCors(request);
  const deny = () => json({ error: "Forbidden" }, 403, cors);

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return deny();

  let body;
  try { body = await request.json(); } catch { return deny(); }

  const itemId = Number(body?.item_id);
  if (!Number.isFinite(itemId)) return deny();

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  // The portal's own read requires portal_members.active and returns items
  // ONLY for weeks whose release_at has passed. Reusing it here means the
  // download rule cannot drift from the rule the portal itself applies.
  let payload;
  try {
    payload = await portalPayloadFromBody({ base, headers: auth }, body);
  } catch { return deny(); }

  if (!payload) return deny();

  // An item can only be found here if its week is unlocked, because a locked
  // week comes back with an empty items array.
  let file = "";
  const weeks = Array.isArray(payload.weeks) ? payload.weeks : [];
  for (const week of weeks) {
    if (!week || week.unlocked !== true || !Array.isArray(week.items)) continue;
    for (const item of week.items) {
      if (item && Number(item.id) === itemId && item.kind === "skill") {
        file = typeof item.url === "string" ? item.url.trim() : "";
      }
    }
  }
  if (!file) return deny();

  // A bare file name, nothing else: no traversal, no folder, no absolute URL.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file)) return deny();

  let signed;
  try {
    const res = await fetch(
      `${base}/storage/v1/object/sign/${SKILL_BUCKET}/${encodeURIComponent(file)}`,
      { method: "POST", headers: auth, body: JSON.stringify({ expiresIn: SKILL_URL_TTL_SECONDS }) }
    );
    if (!res.ok) return deny();
    signed = await res.json();
  } catch { return deny(); }

  // Storage answers with a root-relative path such as
  // "/object/sign/portal-skills/superhuman.zip?token=...".
  const path = (signed && (signed.signedURL || signed.signedUrl)) || "";
  if (typeof path !== "string" || !path) return deny();

  return json({ url: `${base}/storage/v1${path.startsWith("/") ? "" : "/"}${path}` }, 200, cors);
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

// ---------------------------------------------------------------------------
// Portal passcode emails (manual administrator action only)
// ---------------------------------------------------------------------------
// The endpoint intentionally does not use the normal CORS response headers.
// Call it with:
//   POST /portal-passcode-emails
//   Authorization: Bearer <PORTAL_PASSCODE_ADMIN_TOKEN>
//   { "mode": "dry_run" }
// or, after reviewing the dry run:
//   { "mode": "send", "confirm": "SEND_PORTAL_PASSCODES" }
// A real email-format test can be sent only to one or two addresses supplied
// in the request body that also appear in PORTAL_PASSCODE_TEST_RECIPIENTS:
//   { "mode": "test_send", "test_recipients": ["team@example.com"],
//     "confirm": "SEND_PORTAL_PASSCODE_TEST" }
//
// Required secrets (put only in worker/.dev.vars locally or Wrangler secrets
// in production): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
// PORTAL_PASSCODE_ADMIN_TOKEN, PORTAL_PASSCODE_FROM and
// PORTAL_PASSCODE_REPLY_TO.
// Buyer sends are blocked unless Gideon explicitly enables
// PORTAL_PASSCODE_BUYER_SEND_ENABLED after Ella approves the portal.

const PORTAL_PASSCODE_SEND_CONFIRMATION = "SEND_PORTAL_PASSCODES";
const PORTAL_PASSCODE_TEST_CONFIRMATION = "SEND_PORTAL_PASSCODE_TEST";
const PORTAL_ADMIN_HEADERS = { "Cache-Control": "no-store" };
const PORTAL_RECIPIENT_ROLES = new Set(["buyer", "second_seat"]);

async function handlePortalPasscodeEmails(request, env) {
  if (request.method !== "POST") {
    return portalAdminJson({ error: "Method not allowed" }, 405);
  }

  const authorization = request.headers.get("Authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!(await portalSecretsEqual(suppliedToken, env.PORTAL_PASSCODE_ADMIN_TOKEN))) {
    return portalAdminJson({ error: "Unauthorized" }, 401);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return portalAdminJson({ error: "Invalid JSON" }, 400);
  }

  const mode = String(input && input.mode || "");
  if (mode !== "dry_run" && mode !== "send" && mode !== "test_send") {
    return portalAdminJson({ error: "mode must be dry_run, test_send, or send" }, 400);
  }
  if (mode === "send" && input.confirm !== PORTAL_PASSCODE_SEND_CONFIRMATION) {
    return portalAdminJson({ error: "Send requires the explicit confirmation phrase" }, 400);
  }
  if (mode === "test_send" && input.confirm !== PORTAL_PASSCODE_TEST_CONFIRMATION) {
    return portalAdminJson({ error: "Test send requires the explicit confirmation phrase" }, 400);
  }

  const missing = portalMissingConfig(env, mode);
  if (missing.length) {
    // Configuration names are safe operational diagnostics; never log values.
    console.error("portal-passcodes: missing configuration", missing.join(", "));
    return portalAdminJson({ error: "Portal passcode email service is not configured" }, 500);
  }

  if (mode === "test_send") {
    const testRecipients = portalTestRecipients(input.test_recipients, env.PORTAL_PASSCODE_TEST_RECIPIENTS);
    if (!testRecipients) {
      return portalAdminJson({ error: "test_recipients must contain one or two unique valid email addresses" }, 400);
    }
    return sendPortalPasscodeTestEmails(testRecipients, env);
  }

  // Dry runs are always safe, but a real buyer batch has a separate hard
  // release gate. This value is intentionally not set by code or requests:
  // Gideon must set it in the production Worker only after Ella confirms the
  // portal is finished.
  if (mode === "send" && env.PORTAL_PASSCODE_BUYER_SEND_ENABLED !== "true") {
    return portalAdminJson({ error: "Buyer passcode sends are disabled pending portal approval" }, 403);
  }

  let members;
  try {
    members = await fetchEligiblePortalMembers(env);
  } catch (err) {
    console.error("portal-passcodes: could not read eligible members", String(err));
    return portalAdminJson({ error: "Could not load eligible portal members" }, 502);
  }

  const eligible = members.filter((member) => isValidPortalMember(member));
  const skipped = members.length - eligible.length;

  if (mode === "dry_run") {
    console.log("portal-passcodes: dry run complete", { eligible: eligible.length, skipped });
    return portalAdminJson({
      ok: true,
      mode: "dry_run",
      eligible: eligible.length,
      skipped,
      // Previews prove the final copy and recipient list without exposing PII
      // or the credentials that grant portal access.
      previews: eligible.map((member) => portalEmailPreview(member)),
    }, 200);
  }

  let sent = 0;
  let failed = 0;
  for (const member of eligible) {
    try {
      await sendPortalPasscodeEmail(member, env);
      const recorded = await recordPasscodeEmailSent(member.id, env);
      if (!recorded) {
        // Resend's idempotency key prevents an immediate retry from creating a
        // second email. Do not expose the member identity in logs.
        console.error("portal-passcodes: email accepted but sent timestamp was not recorded");
        failed++;
        continue;
      }
      sent++;
    } catch (err) {
      console.error("portal-passcodes: one email was not sent", String(err));
      failed++;
    }
  }

  console.log("portal-passcodes: manual send batch complete", { eligible: eligible.length, sent, failed, skipped });
  return portalAdminJson({
    ok: failed === 0,
    mode: "send",
    eligible: eligible.length,
    sent,
    failed,
    skipped,
  }, failed ? 207 : 200);
}

function portalMissingConfig(env, mode) {
  const required = ["PORTAL_PASSCODE_ADMIN_TOKEN"];
  if (mode !== "dry_run") {
    required.push("RESEND_API_KEY", "PORTAL_PASSCODE_FROM", "PORTAL_PASSCODE_REPLY_TO");
  }
  if (mode !== "test_send") required.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  return required
    .filter((key) => !String(env[key] || "").trim());
}

async function portalSecretsEqual(supplied, expected) {
  if (!supplied || !expected) return false;
  const encoder = new TextEncoder();
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(suppliedHash);
  const b = new Uint8Array(expectedHash);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function fetchEligiblePortalMembers(env) {
  const sb = supabaseService(env);
  if (!sb) throw new Error("Supabase service is not configured");
  const members = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "id,full_name,email,passcode,role",
      active: "eq.true",
      // The database filter is the primary guard; isValidPortalMember below
      // repeats this check so a team account can never be sent a buyer email.
      role: "in.(buyer,second_seat)",
      passcode_sent_at: "is.null",
      email: "not.is.null",
      order: "id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${sb.base}/rest/v1/portal_members?${query}`, {
      headers: sb.headers,
    });
    if (!response.ok) throw new Error(`Supabase read failed (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Supabase read returned an invalid response");
    members.push(...page);
    if (page.length < pageSize) return members;
  }
}

function isValidPortalMember(member) {
  return member && typeof member.id === "string" && /^[0-9a-f-]{36}$/i.test(member.id)
    && PORTAL_RECIPIENT_ROLES.has(member.role)
    && isEmail(member.email) && typeof member.passcode === "string" && member.passcode.trim().length >= 6;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function portalEmailPreview(member) {
  const message = buildPortalPasscodeEmail(member, true);
  return {
    recipient: maskEmail(member.email),
    name: member.full_name ? String(member.full_name).trim() : "Member",
    subject: message.subject,
    text: message.text,
  };
}

// Signing in is the email address itself now, so this email no longer
// carries a passcode. The maskCode argument is kept because the preview
// mode still passes it; there is simply nothing secret left to mask.
function buildPortalPasscodeEmail(member, maskCode) {
  const name = String(member.full_name || "").trim().split(/\s+/)[0] || "there";
  // The dry-run preview goes back to an administrator over HTTP, so the
  // address is masked there the way the recipient field already is. The
  // email that actually reaches the member carries it in full, because
  // that address is now the thing they sign in with.
  const raw = String(member.email || "").trim();
  const address = raw && maskCode ? maskEmail(raw) : raw;
  const line = address
    ? `Go to https://timerich.ai/portal and sign in with this email address: ${address}`
    : "Go to https://timerich.ai/portal and sign in with this email address.";
  return {
    subject: "Your Time Rich portal is ready",
    text: `Hi ${name},\n\nYour Time Rich portal is ready.\n\n${line}\n\nThere is no passcode to remember.\n\nQuestions? Reply to this email or write to emc@timerich.ai.\n\nWarmly,\nElla\nFounder, Time Rich`,
  };
}

function maskEmail(email) {
  const [local, domain] = String(email).trim().split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function maskPasscode(passcode) {
  const code = String(passcode).trim();
  return `${code.slice(0, 2)}***${code.slice(-2)}`;
}

function portalTestRecipients(value, allowedValue) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null;
  const recipients = value.map((email) => String(email || "").trim());
  if (!recipients.every(isEmail)) return null;
  const unique = new Set(recipients.map((email) => email.toLowerCase()));
  if (unique.size !== recipients.length) return null;

  // The test endpoint must not become a general-purpose email sender if its
  // admin token is exposed. Gideon explicitly configures one or two team
  // recipients outside the request, then the request may use only those.
  const allowed = String(allowedValue || "").split(",")
    .map((email) => email.trim().toLowerCase()).filter(isEmail);
  if (allowed.length < 1 || allowed.length > 2 || new Set(allowed).size !== allowed.length) return null;
  return recipients.every((email) => allowed.includes(email.toLowerCase())) ? recipients : null;
}

async function sendPortalPasscodeTestEmails(recipients, env) {
  // This intentionally does not read portal_members or use a member's
  // credentials. It proves the domain, sender and final email layout safely.
  const testMember = { full_name: "Team", passcode: "TEST-12345" };
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      await sendPortalPasscodeEmail(testMember, env, recipient, `portal-passcode-test/${crypto.randomUUID()}`);
      sent++;
    } catch (err) {
      console.error("portal-passcodes: one test email was not sent", String(err));
      failed++;
    }
  }
  console.log("portal-passcodes: manual test-send complete", { requested: recipients.length, sent, failed });
  return portalAdminJson({ ok: failed === 0, mode: "test_send", requested: recipients.length, sent, failed }, failed ? 207 : 200);
}

async function sendPortalPasscodeEmail(member, env, recipient = member.email, idempotencyKey = `portal-passcode/${member.id}`) {
  const message = buildPortalPasscodeEmail(member, false);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // A retry with the same member still maps to the same Resend email.
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env.PORTAL_PASSCODE_FROM,
      reply_to: env.PORTAL_PASSCODE_REPLY_TO,
      to: [recipient],
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) throw new Error(`Resend send failed (${response.status})`);
}

async function recordPasscodeEmailSent(memberId, env) {
  const sb = supabaseService(env);
  if (!sb) throw new Error("Supabase service is not configured");
  const url = `${sb.base}/rest/v1/portal_members?id=eq.${encodeURIComponent(memberId)}&passcode_sent_at=is.null`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...sb.headers, Prefer: "return=representation" },
    body: JSON.stringify({ passcode_sent_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Supabase sent-timestamp update failed (${response.status})`);
  const updated = await response.json();
  return Array.isArray(updated) && updated.length === 1;
}

function portalAdminJson(obj, status) {
  return json(obj, status, PORTAL_ADMIN_HEADERS);
}

// ---------------------------------------------------------------------------
// ThriveCart sends order totals in whole cents ("99700" for $997.00), but the
// Amount column in Notion is a text property, so it has to arrive already
// formatted. Only a plain integer is treated as cents: anything else (an empty
// value, something already carrying a decimal point, or a non-numeric string)
// is passed through untouched rather than guessed at and turned into NaN.
function centsToAmount(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (!value) return "";
  if (!/^-?\d+$/.test(value)) return value;
  return (Number(value) / 100).toFixed(2);
}

// ThriveCart Purchase Webhook (POST /thrivecart-webhook)
// ---------------------------------------------------------------------------
async function handleThriveCartWebhook(request, env, cors, ctx) {
  let body;
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = {};
      for (const [k, v] of params.entries()) {
        body[k] = v;
      }
    } else {
      body = await request.json();
    }
  } catch (err) {
    return json({ ok: false, error: "Invalid webhook payload" }, 400, cors);
  }

  // [TC] tracing: everything below is console only - no behaviour depends on it.
  console.log("[TC] received", JSON.stringify({
    contentType,
    keys: Object.keys(body).slice(0, 40),
    eventRaw: body.event ?? body.type ?? null,
    eventResolved: String(body.event || body.type || "order.success").toLowerCase(),
    modeRaw: body.mode ?? null,
    hasSecretInBody: Boolean(body.thrivecart_secret || body.secret),
    hasSecretInHeader: Boolean(request.headers.get("x-thrivecart-secret")),
  }));

  if (!env.THRIVECART_SECRET) {
    console.log("[TC] secret check: FAILED - THRIVECART_SECRET is not set on the worker");
    return json({ ok: false, error: "ThriveCart webhook is not configured" }, 503, cors);
  }
  const incomingSecret = body.thrivecart_secret || body.secret || request.headers.get("x-thrivecart-secret");
  if (incomingSecret !== env.THRIVECART_SECRET) {
    console.log("[TC] secret check: FAILED - sent secret does not match the worker's THRIVECART_SECRET");
    return json({ ok: false, error: "Invalid secret" }, 401, cors);
  }
  console.log("[TC] secret check: PASSED");

  const event = String(body.event || body.type || "order.success").toLowerCase();
  if (event !== "order.success" && event !== "order.refund") {
    console.log("[TC] branch: IGNORED - event", JSON.stringify(event), "is neither order.success nor order.refund; nothing written to Notion");
    return json({ ok: true, ignored: true, event }, 200, cors);
  }

  // Extract customer data
  const customer = body.customer || {};
  const email = String(customer.email || body.email || body["customer[email]"] || "").trim();
  const firstName = String(customer.first_name || body.first_name || body["customer[first_name]"] || "").trim();
  const lastName = String(customer.last_name || body.last_name || body["customer[last_name]"] || "").trim();
  const fullName = String(customer.name || body.name || `${firstName} ${lastName}`).trim();

  // Extract passthrough tracking ID
  const passthrough = body.passthrough || {};
  const trackingId = String(
    passthrough.tracking_id ||
    passthrough.passthrough_id ||
    body["passthrough[tracking_id]"] ||
    body["passthrough[passthrough_id]"] ||
    body.tracking_id ||
    ""
  ).trim();

  const orderId = String(body.order_id || (body.order && body.order.id) || "").trim();
  const orderTotal = String(body.order_total || (body.order && body.order.total) || "").trim();
  const orderAmount = centsToAmount(orderTotal);   // what the Notion Amount column gets
  const isRefund = event.includes("refund");
  const paymentStatus = isRefund ? "Refunded" : "Paid";
  console.log("[TC] branch:", isRefund ? "REFUNDED" : "PAID", JSON.stringify({
    event,
    willWritePaymentStatus: paymentStatus,
    email: email || null,
    trackingId: trackingId || null,
    orderId: orderId || null,
    orderTotal: orderTotal || null,
    orderAmountWritten: orderAmount || null,
  }));

  // Portal access for the buyer. Only a live, paid order counts: ThriveCart
  // sends test-mode purchases to this same webhook with mode "test", and a
  // payload that does not say "live" at all is treated as a test too.
  const isLive = String(body.mode || "").trim().toLowerCase() === "live";
  if (!isRefund && isLive && email) {
    const portalWork = upsertPortalMember(env, { email, fullName, role: "buyer", orderId }, "[TC]");
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(portalWork);
    else await portalWork;
  } else if (!isRefund) {
    console.log("[TC] portal: SKIPPED -", !isLive ? "not a live order" : "no email on the order");
  }

  const dbId = env.NOTION_SUPERHUMAN_COHORT1_DATABASE_ID;

  if (env.NOTION_TOKEN && dbId) {
    const notionWork = (async () => {
      try {
        let existingPageId = null;
        if (trackingId || email) {
          const filter = trackingId
            ? { property: "TrackingID", rich_text: { equals: trackingId } }
            : { property: "Email", email: { equals: email } };

          const queryRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
            method: "POST",
            headers: { ...authHeaders(env), "Content-Type": "application/json" },
            body: JSON.stringify({ filter }),
          });

          if (queryRes.ok) {
            const queryData = await queryRes.json();
            console.log("[TC] notion lookup:", JSON.stringify({
              by: trackingId ? "TrackingID" : "Email",
              value: trackingId || email,
              httpStatus: queryRes.status,
              matches: (queryData.results || []).length,
            }));
            if (queryData.results && queryData.results.length > 0) {
              existingPageId = queryData.results[0].id;
            }
          } else {
            console.log("[TC] notion lookup: QUERY FAILED", queryRes.status, await queryRes.text());
          }
        } else {
          console.log("[TC] notion lookup: SKIPPED - the payload carried neither a tracking id nor an email");
        }

        if (existingPageId) {
          const properties = {
            "Payment Status": { select: { name: paymentStatus } },
          };
          if (orderId) properties["Order ID"] = { rich_text: [{ text: { content: clip(orderId, 100) } }] };
          if (orderAmount) properties["Amount"] = { rich_text: [{ text: { content: clip(orderAmount, 50) } }] };

          console.log("[TC] notion write: UPDATING existing row", existingPageId, "->", paymentStatus);
          const patchRes = await fetch(`https://api.notion.com/v1/pages/${existingPageId}`, {
            method: "PATCH",
            headers: { ...authHeaders(env), "Content-Type": "application/json" },
            body: JSON.stringify({ properties }),
          });
          // Notion answers 400 for a select option that does not exist, and that
          // is not an exception - so without this the row silently stays Pending.
          console.log("[TC] notion write: PATCH status", patchRes.status, patchRes.ok ? "OK" : await patchRes.text());
        } else {
          const properties = {
            Name: { title: [{ text: { content: clip(fullName || email || "Purchaser", 200) } }] },
            Email: { email: email || null },
            TrackingID: { rich_text: [{ text: { content: clip(trackingId || crypto.randomUUID(), 100) } }] },
            "Payment Status": { select: { name: paymentStatus } },
          };
          if (orderId) properties["Order ID"] = { rich_text: [{ text: { content: clip(orderId, 100) } }] };

          console.log("[TC] notion write: CREATING a new row ->", paymentStatus);
          const createRes = await fetch("https://api.notion.com/v1/pages", {
            method: "POST",
            headers: { ...authHeaders(env), "Content-Type": "application/json" },
            body: JSON.stringify({ parent: { database_id: dbId }, properties }),
          });
          console.log("[TC] notion write: CREATE status", createRes.status, createRes.ok ? "OK" : await createRes.text());
        }
      } catch (err) {
        console.error("[TC] notion sync threw:", err && err.stack ? err.stack : err);
        try { console.error("[TC] error detail:", JSON.stringify(err, Object.getOwnPropertyNames(err || {}))); } catch (_) {}
      }
    })();

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(notionWork);
    }
  }

  // Preserve existing ThriveCart-to-Google-Sheet order integration, adding tracking ID
  const ordersSheetUrl = env.GOOGLE_SHEET_ORDERS_URL || env.GOOGLE_SHEET_WEBHOOK_URL;
  if (ordersSheetUrl) {
    const sheetWork = fetch(ordersSheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab: "Orders",
        event,
        timestamp: new Date().toISOString(),
        orderId,
        trackingId,
        email,
        name: fullName,
        total: orderTotal,
        paymentStatus,
      }),
    }).catch((err) => console.error("Google Sheet Orders error:", err));

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(sheetWork);
    }
  }

  return json({ ok: true, event, trackingId }, 200, cors);
}

// ---------------------------------------------------------------------------
// Onboard verification & submission (GET/POST /onboard)
// ---------------------------------------------------------------------------
async function handleOnboardVerification(request, env, cors, url) {
  const trackingId = (url.searchParams.get("tracking_id") || url.searchParams.get("passthrough[tracking_id]") || "").trim();
  const email = (url.searchParams.get("email") || url.searchParams.get("customer_email") || "").trim();

  if (!trackingId && !email) {
    return json({ ok: true, verified: false, message: "No tracking ID or email provided" }, 200, cors);
  }

  const dbId = env.NOTION_SUPERHUMAN_COHORT1_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) {
    return json({ ok: false, verified: false, error: "Onboarding is not configured" }, 503, cors);
  }

  try {
    const row = await findPaidCohortOrder(env, dbId, trackingId, email);
    if (!row) return json({ ok: true, verified: false, message: "No paid order found" }, 200, cors);
    const props = row.properties || {};
    const nameVal = calProp(props["Name"]) || calProp(props["First name"]) || "Cohort Member";
    const firstName = nameVal.split(" ")[0] || "Cohort Member";
    const paymentStatus = calProp(props["Payment Status"]) || "Paid";
    const secondSeatChoice = calProp(props["Second Seat Option"]) || calProp(props["Second Seat Choice"]) || "";
    const isCompleted = Boolean(secondSeatChoice);
    // calProp returns "" for an empty date, so this is false until the
    // questionnaire has actually been saved.
    const questionnaireCompleted = Boolean(calProp(props["Questionnaire Completed"]));

    return json({
      ok: true,
      verified: true,
      firstName,
      paymentStatus,
      secondSeatChoice,
      isCompleted,
      questionnaireCompleted,
      trackingId: trackingId || calProp(props["TrackingID"]),
      whatsappUrl: env.WHATSAPP_INVITE_URL || "",
    }, 200, cors);
  } catch (err) {
    return json({ ok: false, verified: false, error: "Could not verify the order" }, 502, cors);
  }
}

async function handleOnboardSubmit(data, env, cors, ctx) {
  const trackingId = String(data.trackingId || data.tracking_id || "").trim();
  const email = String(data.email || "").trim();
  const choice = String(data.choice || "named").trim();
  const attendeeFirstName = String(data.attendeeFirstName || "").trim();
  const attendeeLastName = String(data.attendeeLastName || "").trim();
  const attendeeEmail = String(data.attendeeEmail || "").trim();

  const dbId = env.NOTION_SUPERHUMAN_COHORT1_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) return json({ ok: false, error: "Onboarding is not configured" }, 503, cors);
  if (!trackingId && !email) return json({ ok: false, error: "Order details are required" }, 400, cors);

  let paidOrder;
  try {
    paidOrder = await findPaidCohortOrder(env, dbId, trackingId, email);
  } catch {
    return json({ ok: false, error: "Could not verify the order" }, 502, cors);
  }
  if (!paidOrder) return json({ ok: false, error: "A paid order is required" }, 403, cors);

  // Portal access for the +1, on the buyer's order. Skipped when the buyer
  // named themselves, so a buyer row is never touched from this form.
  const buyerEmail = normKey(calProp(paidOrder.properties?.["Email"]) || email);
  if (choice === "named" && EMAIL_RE.test(attendeeEmail) && normKey(attendeeEmail) !== buyerEmail) {
    const portalWork = upsertPortalMember(env, {
      email: attendeeEmail,
      fullName: `${attendeeFirstName} ${attendeeLastName}`,
      role: "second_seat",
      orderId: calProp(paidOrder.properties?.["Order ID"]),
    }, "[onboard]");
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(portalWork);
    else await portalWork;
  }

  {
    const notionWork = (async () => {
      try {
        const properties = {
          // "Not Sure yet" is spelled exactly as the Notion select option is.
          // Notion rejects an option it does not already have, so the casing
          // here is load bearing.
          "Second Seat Option": { select: { name: choice === "named" ? "Named Attendee" : "Not Sure yet" } },
        };
        if (choice === "named") {
          if (attendeeFirstName) properties["Second Seat First Name"] = { rich_text: [{ text: { content: clip(attendeeFirstName, 100) } }] };
          if (attendeeLastName) properties["Second Seat Last Name"] = { rich_text: [{ text: { content: clip(attendeeLastName, 100) } }] };
          if (attendeeEmail) properties["Second Seat Email"] = { email: attendeeEmail };
        }

        await fetch(`https://api.notion.com/v1/pages/${paidOrder.id}`, {
          method: "PATCH",
          headers: { ...authHeaders(env), "Content-Type": "application/json" },
          body: JSON.stringify({ properties }),
        });
      } catch (err) {
        console.error("Onboard Notion sync error:", err);
      }
    })();

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(notionWork);
    }
  }

  const sheetUrl = env.GOOGLE_SHEET_ORDERS_URL || env.GOOGLE_SHEET_WEBHOOK_URL;
  if (sheetUrl) {
    const sheetWork = fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab: "Onboarding",
        timestamp: new Date().toISOString(),
        trackingId,
        email,
        choice,
        attendeeFirstName,
        attendeeLastName,
        attendeeEmail,
      }),
    }).catch((err) => console.error("Google Sheet Onboard error:", err));

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(sheetWork);
    }
  }

  return json({ ok: true }, 200, cors);
}

// ---------------------------------------------------------------------------
// Buyer questionnaire (POST /onboard-questionnaire)
//
// Allowlists for every select and multi-select column below. The browser can
// only ever land one of these strings: Notion refuses an option a database does
// not already have, and answers the whole PATCH with a 400 when it sees one, so
// an unexpected value is dropped rather than taking the write down with it.
// ---------------------------------------------------------------------------
const BQ_BUILD_PRIORITY = [
  "Outreach", "Content", "Systems", "Creating Structure with AI", "Building Agents", "Storytelling/Pitch",
];
const BQ_PROJECT_MANAGEMENT = [
  "Notion", "Asana", "ClickUp", "Monday", "Trello", "Spreadsheet", "In my head", "Other",
];
const BQ_TEAM_SIZE = ["Just me", "2-5", "6-15", "16+"];
// "$2M+/yr" is no longer offered on /superhuman but stays here: it is still a
// live option on the Notion select, /onboard-questionnaire still offers it,
// and a page cached before this change can still send it.
const BQ_REVENUE = [
  "Pre-revenue", "Under $100K/yr", "$100K-500K/yr", "$500K-2M/yr",
  "$2M+/yr", "$2M-5M/yr", "$5M+/yr",
];
const BQ_ONE_TO_ONE = ["Ella Molony Cook", "ViKa Victoria", "Not interested right now"];
const BQ_AI_DAILY_OUTREACH = ["Yes", "No", "Some days"];
const BQ_LEAD_GEN = [
  "LinkedIn", "Instagram", "Email / newsletter", "Cold email or cold call",
  "Referrals", "Events / IRL", "Paid Ads", "Other",
];
const BQ_YES_NO = ["Yes", "No"];

async function handleOnboardQuestionnaire(data, env, cors, ctx) {
  const trackingId = String(data.trackingId || data.tracking_id || "").trim();
  const email = String(data.email || "").trim();

  const dbId = env.NOTION_SUPERHUMAN_COHORT1_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) return json({ ok: false, error: "Onboarding is not configured" }, 503, cors);
  if (!trackingId && !email) return json({ ok: false, error: "Order details are required" }, 400, cors);

  let paidOrder;
  try {
    paidOrder = await findPaidCohortOrder(env, dbId, trackingId, email);
  } catch {
    return json({ ok: false, error: "Could not verify the order" }, 502, cors);
  }
  if (!paidOrder) return json({ ok: false, error: "A paid order is required" }, 403, cors);

  // The same three helpers /qualify uses, for the same reasons.
  const rich = (s) => {
    const v = String(s == null ? "" : s).trim();
    return v ? [{ text: { content: clip(v, 2000) } }] : [];
  };
  const pick = (value, allowed) => {
    const v = String(value == null ? "" : value).trim();
    return allowed.includes(v) ? { select: { name: v } } : null;
  };
  const picks = (value, allowed) => {
    const list = Array.isArray(value) ? value : String(value == null ? "" : value).split(",");
    const names = [];
    for (const item of list) {
      const v = String(item == null ? "" : item).trim();
      if (allowed.includes(v) && names.indexOf(v) === -1) names.push(v);
    }
    return names.length ? { multi_select: names.map((name) => ({ name })) } : null;
  };

  const properties = {
    // What the page reads back to decide whether the questionnaire is still open.
    "Questionnaire Completed": { date: { start: new Date().toISOString().slice(0, 10) } },
  };

  // An empty answer leaves its column alone rather than blanking it, so a
  // second pass over the form can only ever add to what is already there.
  const text = (prop, value) => {
    const body = rich(value);
    if (body.length) properties[prop] = { rich_text: body };
  };
  const select = (prop, value, allowed) => {
    const chosen = pick(value, allowed);
    if (chosen) properties[prop] = chosen;
  };
  const multi = (prop, value, allowed) => {
    const chosen = picks(value, allowed);
    if (chosen) properties[prop] = chosen;
  };

  text("Q Focus Ranking", data.focus_ranking);
  text("Q Success by 20 Nov", data.success_by_20_nov);
  text("Q Personal Transformation", data.personal_transformation);
  select("Q Build Priority", data.build_priority, BQ_BUILD_PRIORITY);
  text("Q Tech Stack", data.tech_stack);
  select("Q Project Management", data.project_management, BQ_PROJECT_MANAGEMENT);
  select("Q Team Size", data.team_size, BQ_TEAM_SIZE);
  select("Q Revenue", data.revenue, BQ_REVENUE);
  text("Q Agents Question", data.agents_question);
  text("Q Content Question", data.content_question);
  text("Q AI OS Question", data.ai_os_question);
  text("Q Storytelling Question", data.storytelling_question);
  multi("Q 1:1 Session", data.one_to_one, BQ_ONE_TO_ONE);
  text("Q Automation Needed", data.automation_needed);
  text("Q Recurring Tasks", data.recurring_tasks);
  select("Q AI Daily Outreach", data.ai_daily_outreach, BQ_AI_DAILY_OUTREACH);
  multi("Q Lead Gen Platforms", data.lead_gen_platforms, BQ_LEAD_GEN);
  text("Q AI in Outreach", data.ai_in_outreach);
  select("Q $100 Vendor Call", data.vendor_call_100, BQ_YES_NO);
  text("Q Bring Someone In", data.bring_someone_in);
  text("Q Other Answers", data.other_answers);

  // Awaited on purpose, unlike every other Notion write in this worker. The
  // page holds the answers in sessionStorage until this comes back ok, so a
  // fire-and-forget failure here would quietly lose someone's typing.
  let saved = false;
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${paidOrder.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    saved = res.ok;
    if (!res.ok) {
      // A missing column or select option comes back as a 400, and the body is
      // the only thing that says which one.
      console.error("[BQ] notion write failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[BQ] notion write threw:", err && err.stack ? err.stack : err);
  }

  if (!saved) return json({ ok: false, error: "Could not save the questionnaire" }, 502, cors);

  // The sheet is a mirror of a write that already succeeded, so it stays
  // fire-and-forget like the rest of them.
  const sheetUrl = env.GOOGLE_SHEET_ORDERS_URL || env.GOOGLE_SHEET_WEBHOOK_URL;
  if (sheetUrl) {
    const list = (value) => (Array.isArray(value) ? value.join(", ") : String(value == null ? "" : value));
    const sheetWork = fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab: "Questionnaire",
        timestamp: new Date().toISOString(),
        trackingId,
        email,
        focusRanking: data.focus_ranking || "",
        successBy20Nov: data.success_by_20_nov || "",
        personalTransformation: data.personal_transformation || "",
        buildPriority: data.build_priority || "",
        techStack: data.tech_stack || "",
        projectManagement: data.project_management || "",
        teamSize: data.team_size || "",
        revenue: data.revenue || "",
        agentsQuestion: data.agents_question || "",
        contentQuestion: data.content_question || "",
        aiOsQuestion: data.ai_os_question || "",
        storytellingQuestion: data.storytelling_question || "",
        oneToOneSession: list(data.one_to_one),
        automationNeeded: data.automation_needed || "",
        recurringTasks: data.recurring_tasks || "",
        aiDailyOutreach: data.ai_daily_outreach || "",
        leadGenPlatforms: list(data.lead_gen_platforms),
        aiInOutreach: data.ai_in_outreach || "",
        vendorCall100: data.vendor_call_100 || "",
        bringSomeoneIn: data.bring_someone_in || "",
        otherAnswers: data.other_answers || "",
      }),
    }).catch((err) => console.error("Google Sheet Questionnaire error:", err));

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(sheetWork);
    }
  }

  return json({ ok: true }, 200, cors);
}

// ---------------------------------------------------------------------------
// Slack ping for a saved Superhuman questionnaire.
//
// Reads the values back out of the Notion `properties` object rather than the
// raw form body, so the message always says what was actually stored: a select
// the form sent but Notion would not accept never reaches Slack.
//
// SLACK_QUESTIONNAIRE_WEBHOOK_URL is a secret. It is never logged, and no
// failure here is ever surfaced to the person who filled the form.
// ---------------------------------------------------------------------------

// Slack mrkdwn needs exactly these three escaped, and nothing else.
function slackEscape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Pull a readable value back out of a Notion property payload.
function notionPropText(properties, name) {
  const prop = properties && properties[name];
  if (!prop) return "";
  if (prop.select && prop.select.name) return String(prop.select.name);
  if (typeof prop.url === "string") return prop.url;
  if (Array.isArray(prop.rich_text) && prop.rich_text.length) {
    return String((prop.rich_text[0].text && prop.rich_text[0].text.content) || "");
  }
  if (Array.isArray(prop.title) && prop.title.length) {
    return String((prop.title[0].text && prop.title[0].text.content) || "");
  }
  return "";
}

function questionnaireSlackText(fields) {
  const props = fields.properties || {};
  const lines = [];

  // Same shape either way, so an update is still readable at a glance.
  const label = fields.updated ? "Updated questionnaire" : "New questionnaire";
  lines.push(
    `*${label}: ${slackEscape(fields.name)}*` +
    (fields.role ? ` (${slackEscape(fields.role)})` : "")
  );

  // Title, Company · Email - any empty part simply drops out.
  const title = notionPropText(props, "Title");
  const company = notionPropText(props, "Company");
  const who = [title, company].filter(Boolean).map(slackEscape).join(", ");
  const identity = [who, fields.email ? slackEscape(fields.email) : ""].filter(Boolean).join(" · ");
  if (identity) lines.push(identity);

  const facts = [
    ["Build priority", notionPropText(props, "Q Build Priority")],
    ["Revenue", notionPropText(props, "Q Revenue")],
    ["Team", notionPropText(props, "Q Team Size")],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${slackEscape(value)}`)
    .join(" · ");
  if (facts) lines.push(facts);

  const linkedin = notionPropText(props, "LinkedIn");
  if (linkedin) lines.push(`LinkedIn: ${slackEscape(linkedin)}`);

  if (fields.pageUrl) lines.push(`<${slackEscape(fields.pageUrl)}|Open in Notion>`);

  return lines.join("\n");
}

function notifySlackQuestionnaire(env, ctx, fields) {
  const webhook = env && env.SLACK_QUESTIONNAIRE_WEBHOOK_URL;
  if (!webhook) return;                       // not configured: skip, silently

  const work = fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: questionnaireSlackText(fields), mrkdwn: true }),
  }).then(
    (res) => {
      // Status only. The URL is a secret and never goes near a log line.
      if (!res.ok) console.error("[SHQ] slack webhook returned", res.status);
    },
    () => { console.error("[SHQ] slack webhook request failed"); }
  );

  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work);
}

// ---------------------------------------------------------------------------
// Superhuman questionnaire (POST /superhuman-questionnaire)
//
// The same twenty questions /onboard-questionnaire takes, on a page of their
// own, with three differences:
//
//   * no order lookup at all. Buyers, second seats and ambassadors all answer
//     the same thing, so the gate is a shape check on name, email and role
//     plus the honeypot, not a paid row in Notion;
//   * the row is created here rather than found, because there is no order row
//     to hang the answers off. An email that has already answered is PATCHed,
//     so a second pass tops up one row instead of leaving two;
//   * Name, Email, Role and Submitted are written alongside the Q columns.
//
// Everything else - the allowlists, the 2,000-char trim, the "empty answers
// leave their column alone" rule and the awaited write - is lifted straight
// from handleOnboardQuestionnaire, deliberately: the two land the same answers
// and must agree on exactly what Notion will accept.
// ---------------------------------------------------------------------------
const SHQ_ROLES = ["Buyer", "+1", "Ambassador"];

async function handleSuperhumanQuestionnaire(data, env, cors, ctx) {
  // Honeypot first, and answered 200 rather than 4xx: a bot told it failed
  // tries again, and nothing downstream has run yet.
  if (String(data._gotcha || "").trim()) return json({ ok: true }, 200, cors);

  const dbId = env.NOTION_SUPERHUMAN_QUESTIONNAIRE_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId) {
    return json({ ok: false, error: "The questionnaire is not configured" }, 503, cors);
  }

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim();
  const role = String(data.role || "").trim();

  if (!name) return json({ ok: false, error: "A name is required" }, 400, cors);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: "A valid email is required" }, 400, cors);
  }
  if (!SHQ_ROLES.includes(role)) return json({ ok: false, error: "A role is required" }, 400, cors);

  // The same three helpers /qualify and /onboard-questionnaire use.
  const rich = (s) => {
    const v = String(s == null ? "" : s).trim();
    return v ? [{ text: { content: clip(v, 2000) } }] : [];
  };
  const pick = (value, allowed) => {
    const v = String(value == null ? "" : value).trim();
    return allowed.includes(v) ? { select: { name: v } } : null;
  };
  const picks = (value, allowed) => {
    const list = Array.isArray(value) ? value : String(value == null ? "" : value).split(",");
    const names = [];
    for (const item of list) {
      const v = String(item == null ? "" : item).trim();
      if (allowed.includes(v) && names.indexOf(v) === -1) names.push(v);
    }
    return names.length ? { multi_select: names.map((n) => ({ name: n })) } : null;
  };

  const properties = {
    "Name": { title: rich(name) },
    "Email": { email: email },
    "Role": { select: { name: role } },
    "Submitted": { date: { start: new Date().toISOString().slice(0, 10) } },
  };

  // An empty answer leaves its column alone rather than blanking it, so a
  // second pass over the form can only ever add to what is already there.
  const text = (prop, value) => {
    const body = rich(value);
    if (body.length) properties[prop] = { rich_text: body };
  };
  const select = (prop, value, allowed) => {
    const chosen = pick(value, allowed);
    if (chosen) properties[prop] = chosen;
  };
  const multi = (prop, value, allowed) => {
    const chosen = picks(value, allowed);
    if (chosen) properties[prop] = chosen;
  };
  // Notion rejects "" for a url column, so an empty or unusable link leaves
  // its column alone. https only, matching what the page enforces: anything
  // else is a half-pasted address, and guessing a scheme onto it would store
  // a link that does not resolve.
  const link = (prop, value) => {
    const v = String(value == null ? "" : value).trim();
    if (!v) return;
    let parsed;
    try { parsed = new URL(v); } catch { return; }
    if (parsed.protocol !== "https:") return;
    properties[prop] = { url: clip(v, 2000) };
  };


  // Who they are and what they do. The page asks these on two grouped screens
  // but sends them flat, one key per Notion column.
  link("LinkedIn", data.linkedin);
  link("Instagram", data.instagram);
  text("Other Links", data.other_links);
  text("Title", data.job_title);
  text("Company", data.company);
  text("What the Company Does", data.company_does);
  text("Who They Serve", data.who_you_serve);
  text("Bio", data.bio);
  link("Photo Link", data.photo_link);
  text("Superpower", data.superpower);

  text("Q Focus Ranking", data.focus_ranking);
  text("Q Success by 20 Nov", data.success_by_20_nov);
  text("Q Personal Transformation", data.personal_transformation);
  select("Q Build Priority", data.build_priority, BQ_BUILD_PRIORITY);
  text("Q Tech Stack", data.tech_stack);
  select("Q Project Management", data.project_management, BQ_PROJECT_MANAGEMENT);
  select("Q Team Size", data.team_size, BQ_TEAM_SIZE);
  select("Q Revenue", data.revenue, BQ_REVENUE);
  text("Q Agents Question", data.agents_question);
  text("Q Content Question", data.content_question);
  text("Q AI OS Question", data.ai_os_question);
  text("Q Storytelling Question", data.storytelling_question);
  multi("Q 1:1 Session", data.one_to_one, BQ_ONE_TO_ONE);
  text("Q Automation Needed", data.automation_needed);
  text("Q Recurring Tasks", data.recurring_tasks);
  select("Q AI Daily Outreach", data.ai_daily_outreach, BQ_AI_DAILY_OUTREACH);
  multi("Q Lead Gen Platforms", data.lead_gen_platforms, BQ_LEAD_GEN);
  // "Q AI in Outreach" is deliberately not written: the question that fed it
  // was dropped from the page. The Notion column is kept for the answers
  // already in it.
  select("Q $100 Vendor Call", data.vendor_call_100, BQ_YES_NO);
  text("Q Bring Someone In", data.bring_someone_in);
  text("Q Other Answers", data.other_answers);

  // One row per email. A failed lookup is not fatal: creating a second row is
  // a far better outcome than telling someone their answers were lost, so the
  // miss is logged and the write falls through to a create.
  let existing = null;
  try {
    existing = await findRowByEmail(env, dbId, email);
  } catch (err) {
    console.error("[SHQ] existing-row lookup failed:", err && err.stack ? err.stack : err);
  }

  // Awaited on purpose, unlike most of the Notion writes in this worker. The
  // page holds the answers in sessionStorage until this comes back ok, so a
  // fire-and-forget failure here would quietly lose someone's typing.
  let saved = false;
  let page = null;              // the created or patched row, for the Slack link
  try {
    const res = existing
      ? await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
          method: "PATCH",
          headers: { ...authHeaders(env), "Content-Type": "application/json" },
          body: JSON.stringify({ properties }),
        })
      : await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: { ...authHeaders(env), "Content-Type": "application/json" },
          body: JSON.stringify({ parent: { database_id: dbId }, properties }),
        });
    saved = res.ok;
    if (res.ok) {
      try { page = await res.json(); } catch { /* the row saved; only the link is lost */ }
    }
    if (!res.ok) {
      // A missing column or select option comes back as a 400, and the body is
      // the only thing that says which one.
      console.error("[SHQ] notion write failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[SHQ] notion write threw:", err && err.stack ? err.stack : err);
  }

  if (!saved) return json({ ok: false, error: "Could not save the questionnaire" }, 502, cors);

  // Slack is told only after the row is safely in Notion, and never gets in
  // the way: waitUntil keeps it off the response path, so an outage at Slack
  // cannot turn a saved questionnaire into an error for the person filling it.
  notifySlackQuestionnaire(env, ctx, {
    updated: Boolean(existing),
    name,
    role,
    email,
    properties,
    pageUrl: page && typeof page.url === "string" ? page.url : "",
  });

  // Time Rich Members: copy the saved profile into portal_directory. Built
  // from the properties Notion stored (the reply to the write), not from this
  // request body, and off the response path like Slack.
  queueDirectorySync(env, ctx, page);

  // The sheet is a mirror of a write that already succeeded, so it stays
  // fire-and-forget like the rest of them.
  const sheetUrl = env.GOOGLE_SHEET_ORDERS_URL || env.GOOGLE_SHEET_WEBHOOK_URL;
  if (sheetUrl) {
    const list = (value) => (Array.isArray(value) ? value.join(", ") : String(value == null ? "" : value));
    const sheetWork = fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab: "Superhuman Questionnaire",
        timestamp: new Date().toISOString(),
        name,
        email,
        role,
        linkedin: data.linkedin || "",
        instagram: data.instagram || "",
        otherLinks: data.other_links || "",
        jobTitle: data.job_title || "",
        company: data.company || "",
        companyDoes: data.company_does || "",
        whoTheyServe: data.who_you_serve || "",
        bio: data.bio || "",
        photoLink: data.photo_link || "",
        superpower: data.superpower || "",
        focusRanking: data.focus_ranking || "",
        successBy20Nov: data.success_by_20_nov || "",
        personalTransformation: data.personal_transformation || "",
        buildPriority: data.build_priority || "",
        techStack: data.tech_stack || "",
        projectManagement: data.project_management || "",
        teamSize: data.team_size || "",
        revenue: data.revenue || "",
        agentsQuestion: data.agents_question || "",
        contentQuestion: data.content_question || "",
        aiOsQuestion: data.ai_os_question || "",
        storytellingQuestion: data.storytelling_question || "",
        oneToOneSession: list(data.one_to_one),
        automationNeeded: data.automation_needed || "",
        recurringTasks: data.recurring_tasks || "",
        aiDailyOutreach: data.ai_daily_outreach || "",
        leadGenPlatforms: list(data.lead_gen_platforms),
        vendorCall100: data.vendor_call_100 || "",
        bringSomeoneIn: data.bring_someone_in || "",
        otherAnswers: data.other_answers || "",
      }),
    }).catch((err) => console.error("Google Sheet Superhuman Questionnaire error:", err));

    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(sheetWork);
  }

  return json({ ok: true }, 200, cors);
}

// The questionnaire's own lookup: one row per email, with no payment status in
// the picture. Same filter-then-check shape as findPaidRow below and for the
// same reason - Notion's "equals" on a string is an exact byte match, so a
// stored "Ada@Example.com " would never match - but "contains" is matched case
// insensitively, and the exact comparison is then done here.
async function findRowByEmail(env, dbId, email) {
  const wanted = normKey(email);
  if (!wanted) return null;

  const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { property: "Email", email: { contains: String(email).trim() } },
      page_size: 100,
    }),
  });
  if (!response.ok) throw new Error("Notion questionnaire lookup failed");

  const results = (await response.json()).results || [];
  // "contains" can over-match, so only a row whose address really is the one
  // asked for counts.
  return results.find((row) => normKey(calProp(row.properties?.["Email"])) === wanted) || null;
}

// Comparison key for everything matched below: trimmed and lowercased, so a
// stored "Paid " or "Gideon@Example.com" lines up with what the page asks for.
function normKey(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

// One query against one property, returning that buyer's paid row.
//
// The filter is deliberately looser than the comparison. Notion's string
// "equals" is an exact byte match, which is the same trap findCalApplicant
// documents above, so a cell saved with capitals or a stray space never
// matched. "contains" is matched case insensitively by Notion, and the exact
// check is then done here against the real value.
//
// Every returned row is checked, not just the first. A buyer can legitimately
// have more than one: POST /join writes a Pending row before checkout, and the
// ThriveCart webhook only updates that row when the tracking id or email lines
// up, so a Pending and a Paid row can both exist for one person. Notion
// promises no particular order, so reading results[0] was a coin flip, and
// landing on the Pending row told a genuinely paid buyer there was no order.
async function findPaidRow(env, dbId, property, value) {
  const wanted = normKey(value);
  if (!wanted) return null;

  const needle = String(value).trim();
  const filter = property === "Email"
    ? { property, email: { contains: needle } }
    : { property, rich_text: { contains: needle } };

  const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({ filter, page_size: 100 }),
  });
  if (!response.ok) throw new Error("Notion order lookup failed");

  const results = (await response.json()).results || [];
  // "contains" can over-match, so only rows whose value really is the one
  // asked for are considered.
  const mine = results.filter((row) => normKey(calProp(row.properties?.[property])) === wanted);
  const paid = mine.find((row) => normKey(calProp(row.properties?.["Payment Status"])) === "paid");

  if (!paid) {
    // The one line worth having in the tail when a buyer says they cannot get in.
    console.log("[onboard] lookup miss:", JSON.stringify({
      by: property,
      rowsReturned: results.length,
      rowsMatchingExactly: mine.length,
      statusesSeen: mine.map((row) => calProp(row.properties?.["Payment Status"])),
    }));
  }
  return paid || null;
}

// ---------------------------------------------------------------------------
// Portal members (Supabase)
//
// Adds or updates one row in portal_members through portal_upsert_member(),
// which only service_role can execute. Email is the key, so a repeat order or
// a resubmitted form updates the existing row instead of adding another. The
// function never reads or returns a passcode, and nothing here logs the key,
// the email or the response body.
//
// Never throws: a Supabase outage must not change what ThriveCart or the
// onboarding page get back.
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function upsertPortalMember(env, { email, fullName, role, orderId }, tag) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(tag, "portal: SKIPPED - Supabase is not configured on the worker");
    return;
  }
  const cleanEmail = normKey(email);
  if (!EMAIL_RE.test(cleanEmail)) {
    console.log(tag, "portal: SKIPPED - not a valid email");
    return;
  }

  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, "Content-Type": "application/json" };
  // A legacy service_role key is a JWT and goes in Authorization too; the
  // newer sb_secret_ keys are not JWTs and only belong in apikey.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/portal_upsert_member`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_email: cleanEmail,
        p_full_name: clip(String(fullName || "").trim(), 200),
        p_role: role,
        p_order_id: clip(String(orderId || "").trim(), 100),
      }),
    });
    console.log(tag, "portal: upsert", role, "status", res.status);
  } catch (err) {
    console.error(tag, "portal: upsert failed", err && err.message ? err.message : "unknown error");
  }
}

async function findPaidCohortOrder(env, dbId, trackingId, email) {
  // Tracking id first, since it names the order exactly. A tracking id that
  // does not line up with the row, from an old link or a capture written
  // before checkout, used to end the search there even when the email would
  // have found the buyer, so the email is now tried after it.
  if (trackingId) {
    const hit = await findPaidRow(env, dbId, "TrackingID", trackingId);
    if (hit) return hit;
  }
  if (email) return findPaidRow(env, dbId, "Email", email);
  return null;
}

// ---------------------------------------------------------------------------
// Time Rich Members: the portal member directory
//
// portal_directory (Supabase) holds one profile per accelerator member, built
// from their Superhuman questionnaire row in Notion. Members never type
// anything twice: every saved questionnaire is copied across, and sending the
// form again is how a member edits their profile.
//
// Only buyers and second seats with an active portal_members row are listed.
// Team, ambassadors and anyone without portal access are skipped. Everything
// here runs with the service role key and never on the response path of the
// questionnaire, so a Supabase outage cannot turn a saved form into an error.
// ---------------------------------------------------------------------------

const DIRECTORY_LISTED_ROLES = ["buyer", "second_seat"];

// portal_directory column <- Notion column, in the order a profile reads.
const DIRECTORY_FIELDS = [
  ["name", "Name"],
  ["hook_line", "Bio"],
  ["title", "Title"],
  ["company", "Company"],
  ["company_does", "What the Company Does"],
  ["who_they_serve", "Who They Serve"],
  ["superpower", "Superpower"],
  ["linkedin", "LinkedIn"],
  ["instagram", "Instagram"],
  ["other_links", "Other Links"],
];

// Base URL and service-role headers for Supabase REST and Storage, or null
// when the Worker is not configured for the portal.
function supabaseService(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    base: env.SUPABASE_URL.replace(/\/+$/, ""),
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}

// The member's portal_members row, if they are listed in the directory.
// portal_members.email is not guaranteed lowercase, so this matches case
// insensitively and then checks the address exactly, the same
// filter-then-check shape as findRowByEmail.
async function findListedMember(sb, email) {
  const res = await fetch(
    `${sb.base}/rest/v1/portal_members?select=email,role&active=is.true&email=ilike.${encodeURIComponent(email)}`,
    { headers: sb.headers }
  );
  if (!res.ok) throw new Error(`portal_members lookup returned ${res.status}`);
  const rows = await res.json();
  const member = (Array.isArray(rows) ? rows : []).find((row) => normKey(row.email) === email);
  return member && DIRECTORY_LISTED_ROLES.includes(member.role) ? member : null;
}

// One portal_directory row from a Notion questionnaire row. An empty Notion
// cell becomes null, never "".
function directoryRowFromNotion(email, role, properties) {
  const row = { email, role, updated_at: new Date().toISOString() };
  for (const [column, prop] of DIRECTORY_FIELDS) {
    row[column] = calProp(properties[prop]) || null;
  }
  return row;
}

async function upsertDirectoryRow(sb, row) {
  const res = await fetch(`${sb.base}/rest/v1/portal_directory?on_conflict=email`, {
    method: "POST",
    headers: { ...sb.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`portal_directory upsert returned ${res.status}`);
}

// The photo columns already stored for this member, or null for a new row.
async function findDirectoryRow(sb, email) {
  const res = await fetch(
    `${sb.base}/rest/v1/portal_directory?select=photo_path,photo_status,photo_source_url&email=eq.${encodeURIComponent(email)}`,
    { headers: sb.headers }
  );
  if (!res.ok) throw new Error(`portal_directory lookup returned ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Copies one Notion questionnaire row into portal_directory.
// Returns { outcome: "listed" | "skipped", photo }, where photo is "ok",
// "failed", "missing" or "kept". Throws only when Supabase itself fails.
async function syncDirectoryProfile(env, properties) {
  const sb = supabaseService(env);
  if (!sb) throw new Error("Supabase is not configured");

  const email = normKey(calProp(properties && properties["Email"]));
  if (!email) return { outcome: "skipped" };

  const member = await findListedMember(sb, email);
  if (!member) return { outcome: "skipped" };

  const row = directoryRowFromNotion(email, member.role, properties);
  const existing = await findDirectoryRow(sb, email);
  const photo = await syncDirectoryPhoto(env, sb, row, existing, calProp(properties["Photo Link"]).trim());

  await upsertDirectoryRow(sb, row);
  return { outcome: "listed", photo };
}

// ---------------------------------------------------------------------------
// Photos: a Google Drive link in the questionnaire becomes a private image in
// the "portal-directory" bucket, served later only as a signed URL.
//
// The download is retried only when it can change something: a new link, or
// the same link after a failed or missing attempt (someone who fixed their
// sharing setting but kept the link). Otherwise the stored photo is kept and
// Drive is not called at all.
//
// The link is never logged, and neither is an error object, because either
// could carry it. Failures are reported to the team as one Slack line.
// ---------------------------------------------------------------------------
const DIRECTORY_BUCKET = "portal-directory";
const DIRECTORY_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const DIRECTORY_PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Sets the photo columns on `row` and returns what happened.
async function syncDirectoryPhoto(env, sb, row, existing, link) {
  if (!link) {
    // Notion keeps an earlier link when a resubmission leaves it empty, so no
    // link here means the member has never given one.
    if (!existing || existing.photo_status !== "ok") row.photo_status = "missing";
    return existing && existing.photo_status === "ok" ? "kept" : "missing";
  }

  const unchanged = existing && existing.photo_source_url === link && existing.photo_status === "ok";
  if (unchanged) return "kept";

  const image = await downloadDrivePhoto(link);
  if (!image) {
    // Keep any earlier photo_path and photo_source_url: the next attempt
    // compares against the last link that actually worked.
    row.photo_status = "failed";
    await notifyPhotoFailed(env, row.name);
    return "failed";
  }

  const path = `${await sha256Hex(row.email)}.${image.ext}`;
  const uploaded = await fetch(`${sb.base}/storage/v1/object/${DIRECTORY_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: sb.headers.apikey, Authorization: sb.headers.Authorization, "Content-Type": image.type, "x-upsert": "true" },
    body: image.bytes,
  });
  if (!uploaded.ok) throw new Error(`photo upload returned ${uploaded.status}`);

  // A new file type leaves the old object behind under the other extension.
  if (existing && existing.photo_path && existing.photo_path !== path) {
    await fetch(`${sb.base}/storage/v1/object/${DIRECTORY_BUCKET}/${existing.photo_path}`, {
      method: "DELETE",
      headers: { apikey: sb.headers.apikey, Authorization: sb.headers.Authorization },
    }).catch(() => {});
  }

  row.photo_path = path;
  row.photo_status = "ok";
  row.photo_source_url = link;
  return "ok";
}

// The Drive file id from the three link shapes people paste:
//   https://drive.google.com/file/d/<id>/view?usp=sharing
//   https://drive.google.com/open?id=<id>
//   https://drive.google.com/uc?id=<id>&export=download
function driveFileId(link) {
  let url;
  try { url = new URL(link); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (!/^(drive|docs)\.google\.com$/.test(url.hostname)) return null;

  const id = /^\/file\/d\/([^/]+)/.test(url.pathname)
    ? url.pathname.match(/^\/file\/d\/([^/]+)/)[1]
    : (/^\/(open|uc)$/.test(url.pathname) ? url.searchParams.get("id") : null);
  return id && /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : null;
}

// Downloads a publicly shared Drive file. Returns { bytes, type, ext } only
// for a JPEG, PNG or WebP of at most 5 MB; anything else (a bad link, Drive's
// HTML sign-in page for a file that is not shared, a huge file) is null.
async function downloadDrivePhoto(link) {
  const id = driveFileId(link);
  if (!id) return null;

  let res;
  try {
    res = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`, { redirect: "follow" });
  } catch {
    return null;
  }
  const type = String(res.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const ext = DIRECTORY_PHOTO_TYPES[type];
  const declared = Number(res.headers.get("Content-Length"));
  if (!res.ok || !ext || (declared && declared > DIRECTORY_PHOTO_MAX_BYTES)) {
    try { await res.body?.cancel(); } catch { /* nothing to free */ }
    return null;
  }

  const bytes = await readAtMost(res, DIRECTORY_PHOTO_MAX_BYTES);
  return bytes && bytes.byteLength ? { bytes, type, ext } : null;
}

// Reads a response body, giving up (null) as soon as it passes `max` bytes,
// so a file that lies about its size is never held in memory whole.
async function readAtMost(res, max) {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// One line to the questionnaire Slack channel. Never the link itself.
async function notifyPhotoFailed(env, name) {
  const webhook = env && env.SLACK_QUESTIONNAIRE_WEBHOOK_URL;
  if (!webhook) return;
  const who = slackEscape(String(name || "").trim() || "a member");
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Photo link failed for ${who}. Ask them to set sharing to Anyone with the link.` }),
    });
    if (!res.ok) console.error("[members] photo slack webhook returned", res.status);
  } catch {
    console.error("[members] photo slack webhook request failed");
  }
}

// Called after the questionnaire is safely in Notion. `page` is Notion's reply
// to the create or update, which carries every stored property, so a partial
// resubmission still produces a complete profile.
function queueDirectorySync(env, ctx, page) {
  if (!page || !page.properties || !supabaseService(env)) return;
  const work = syncDirectoryProfile(env, page.properties).catch((err) => {
    // Our own messages only: never the payload, a link or an error object.
    console.error("[members] directory sync failed:", String(err && err.message));
  });
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work);
}

// ---------------------------------------------------------------------------
// POST /portal-directory  body: { code }
//
// The read side of Time Rich Members. The passcode is checked with
// portal_get() exactly as /portal-download does, so the rule for who is a
// member cannot drift. Until the directory_enabled switch is on, only team
// gets through, so the page can be QA'd before launch without a code release.
//
// Every refusal is the same flat 403: a wrong code, a switched-off directory
// and a Supabase error all look identical from outside. Email and
// photo_source_url are never selected, so they cannot leak into a response.
// ---------------------------------------------------------------------------
const DIRECTORY_PHOTO_URL_TTL_SECONDS = 3600; // 1 hour
const DIRECTORY_PUBLIC_COLUMNS =
  "name,hook_line,title,company,company_does,who_they_serve,superpower,linkedin,instagram,other_links,photo_path,photo_status";

async function handlePortalDirectory(request, env) {
  const cors = portalDownloadCors(request);
  const deny = () => json({ error: "Forbidden" }, 403, cors);

  const sb = supabaseService(env);
  if (!sb) return deny();

  let body;
  try { body = await request.json(); } catch { return deny(); }

  let member;
  try {
    const payload = await portalPayloadFromBody(sb, body);
    if (!payload) return deny();
    member = payload.member || {};
  } catch { return deny(); }

  if (member.role !== "team") {
    try {
      if (!(await directoryEnabled(sb))) return deny();
    } catch { return deny(); }
  }

  let rows;
  try {
    const res = await fetch(`${sb.base}/rest/v1/portal_directory?select=${DIRECTORY_PUBLIC_COLUMNS}`, { headers: sb.headers });
    if (!res.ok) return deny();
    rows = await res.json();
  } catch { return deny(); }
  if (!Array.isArray(rows)) return deny();

  const photoUrls = await signDirectoryPhotos(sb, rows);

  const profiles = rows
    .map((row) => ({
      name: row.name || "",
      hook_line: row.hook_line || "",
      title: row.title || "",
      company: row.company || "",
      company_does: row.company_does || "",
      who_they_serve: row.who_they_serve || "",
      superpower: row.superpower || "",
      linkedin: httpsLink(row.linkedin),
      instagram: httpsLink(row.instagram),
      other_links: String(row.other_links || "").split(/\r?\n/).map(httpsLink).filter(Boolean),
      photo_url: (row.photo_status === "ok" && photoUrls.get(row.photo_path)) || null,
    }))
    .filter((profile) => profile.name)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  return json({ profiles }, 200, cors);
}

// True only when the switch is literally on; a missing row means off.
async function directoryEnabled(sb) {
  const res = await fetch(`${sb.base}/rest/v1/portal_settings?select=value&key=eq.directory_enabled`, { headers: sb.headers });
  if (!res.ok) throw new Error(`portal_settings lookup returned ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 && rows[0].value === true;
}

// One-hour signed URLs for every stored photo, in a single Storage call.
// A signing failure costs the photos, not the page: those cards show initials.
async function signDirectoryPhotos(sb, rows) {
  const urls = new Map();
  const paths = rows
    .filter((row) => row && row.photo_status === "ok" && typeof row.photo_path === "string" && row.photo_path)
    .map((row) => row.photo_path);
  if (!paths.length) return urls;

  try {
    const res = await fetch(`${sb.base}/storage/v1/object/sign/${DIRECTORY_BUCKET}`, {
      method: "POST",
      headers: sb.headers,
      body: JSON.stringify({ expiresIn: DIRECTORY_PHOTO_URL_TTL_SECONDS, paths }),
    });
    if (!res.ok) return urls;
    const signed = await res.json();
    for (const item of Array.isArray(signed) ? signed : []) {
      const path = item && (item.signedURL || item.signedUrl);
      if (item && !item.error && typeof path === "string" && path) {
        urls.set(item.path, `${sb.base}/storage/v1${path.startsWith("/") ? "" : "/"}${path}`);
      }
    }
  } catch { /* initials instead of photos */ }
  return urls;
}

// The link if it is a well-formed https URL, otherwise null.
function httpsLink(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return null;
  try {
    return new URL(text).protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

// Constant-time comparison of two secrets of any length: both are hashed
// first, so the loop always runs over 32 bytes whatever was sent.
async function secretsMatch(given, expected) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(given))),
    crypto.subtle.digest("SHA-256", enc.encode(String(expected))),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// POST /portal-directory-sync  (Authorization: Bearer <DIRECTORY_SYNC_SECRET>)
//
// Backfill: runs the same sync over every row of the Superhuman Questionnaire
// database, for members who answered before the directory existed. Safe to
// run any number of times; each row ends in the same state.
async function handleDirectoryBackfill(request, env, cors) {
  const deny = () => json({ error: "Forbidden" }, 403, cors);
  if (!env.DIRECTORY_SYNC_SECRET) return deny();

  const header = request.headers.get("Authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !(await secretsMatch(given, env.DIRECTORY_SYNC_SECRET))) return deny();

  const dbId = env.NOTION_SUPERHUMAN_QUESTIONNAIRE_DATABASE_ID;
  if (!env.NOTION_TOKEN || !dbId || !supabaseService(env)) {
    return json({ ok: false, error: "The directory sync is not configured" }, 503, cors);
  }

  const counts = { processed: 0, listed: 0, skipped: 0, failed: 0, photo_failed: 0 };
  let cursor = null;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify(cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 }),
    });
    if (!res.ok) return json({ ok: false, error: "Could not read the questionnaire", ...counts }, 502, cors);

    const data = await res.json();
    for (const row of data.results || []) {
      counts.processed++;
      try {
        const result = await syncDirectoryProfile(env, row.properties || {});
        counts[result.outcome]++;
        if (result.photo === "failed") counts.photo_failed++;
      } catch (err) {
        counts.failed++;
        console.error("[members] backfill row failed:", String(err && err.message));
      }
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : null;
  } while (cursor);

  return json({ ok: true, ...counts }, 200, cors);
}
