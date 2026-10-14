# Brief: timerich.ai/os redesign (layout + placeholder copy)

## Before you start
1. `git fetch origin && git checkout main && git pull origin main` (teammates merge work).
2. Create a branch: `git checkout -b os-redesign`.
3. Do NOT commit or push. Gideon reviews locally and commits himself.
4. This file (`OS-REDESIGN-BRIEF.md`) must not be committed. Leave it untracked.

## Goal
Rebuild `os/index.html` as one tight scroll: hero, subscribe band, seven folded dropdown rows, footer.
The copy below is placeholder. Ella is still editing it, so keep every piece of text easy to find and swap (plain HTML text, no copy inside JS strings).

Read the current `os/index.html` first. Keep:
- the existing master prompt text, the one-paragraph version, the recurring work audit prompt, and the text-shortcut steps (Mac, iPhone, test), word for word
- the existing copy buttons and their behaviour
- the existing head tags: og-time-rich.png link preview, analytics, favicon
- the existing styling approach on the site (Tailwind or inline CSS, whichever the page uses now)

## Brand (timerich.ai/brand)
- Colours: deep green #2C3422, cream #FFFCEB, pastel #CCEEA0 (the only accent), sage #DCDEBF
- Fonts: Space Grotesk Bold for headings, JetBrains Mono for eyebrows/labels
- Wordmark: "TIME RICH." with a pastel full stop
- Match the look of other timerich.ai pages (nav, footer, buttons)

## Layout rules
- Order: Nav, Hero, Subscribe band, Dropdown rows, Footer
- Subscribe band: full width, always visible, never inside a dropdown
- Dropdown rows, folded: bold outcome headline, one grey line under it, chevron on the right
- Open: short body, steps, then the button. Nothing else
- The Stanley row is open on load. All others start folded
- The whole row is the click target. Only one row open at a time (opening one closes the other)
- Each row has an anchor id: #stanley, #compass, #skills, #prompts, #content-os, #stack, #live. Loading timerich.ai/os#compass opens that row and scrolls to it. Nav links do the same
- Accessible: button with aria-expanded and aria-controls, keyboard (Enter/Space), visible focus
- Thumb-friendly on mobile (big tap targets, no horizontal scroll at 375px)
- No section numbers, no numbered steps (use bullets; each step starts with a bold verb), no tool/skill/subscriber counts
- Nav: Stanley, COMPASS, Skills, Prompts, Workshops. Button on the right: Subscribe (→ https://timerichclub.com)

## Copy (placeholder)

Meta description: Free LinkedIn skills, the Business COMPASS and the AI content setup Time Rich founders use. Set it up in an afternoon.

### Hero
- Eyebrow: TIME RICH CONTENT OS
- Headline: Post every week without writing from a blank page.
- Body: Everything from the workshop in one place: the AI Head of Content that runs your posting, the LinkedIn skills, the Business COMPASS and the prompts that make AI ask before it guesses. Set it up once. Use it every week.
- Time Rich line: Time Rich is an AI education platform and founder community, run by Ella Molony Cook: four companies, one exit, early investor in Anthropic. We run live workshops in New York and online where you build alongside us, not watch slides.
- Buttons: "Set up Stanley" (opens the #stanley row) · "Subscribe free" (→ https://timerichclub.com)

### Subscribe band
- Headline: Get every new skill the day it ships.
- Body: The skills on this page are free. New ones land after every workshop, and subscribers get them first. Join founders, operators and investors on the Time Rich Substack.
- Button: Subscribe free → https://timerichclub.com

### Row: Stanley (#stanley, open by default)
- Folded: Get an AI Head of Content posting for you this week.
- Grey line: The fast route. No prompts, no workflows to build.
- Body: Stanley is an AI Head of Content you text. It plans, drafts, repurposes and schedules, and it already knows how to do the job. Works by SMS, WhatsApp or web. It is what Ella uses every day.
- Steps:
  - **Sign up** with the button below. It takes two minutes.
  - **Tell it who you are.** Paste in your Business COMPASS, or your offer, your audience and three posts you are proud of. The more it knows, the less you edit.
  - **Connect your notetaker.** Your best ideas are already said out loud on calls. Connect Granola (link: https://join.granola.ai/t/zcp5ejgifv) and Stanley turns your meetings into post drafts. Granola does not record video or join your calls. Extended free trial with this link.
  - **Switch on the rituals** Ella runs:
    - **Good morning**, every morning: today's plan and what to post
    - **Repurpose**, every morning: yesterday's post adapted for each platform
    - **Substack notes**, late morning: short notes drafted from your ideas
    - **Calls to posts**, every evening: today's meetings turned into drafts
    - **Weekly review**, Sunday morning: what worked, what to post next week
- Button: Get Stanley → https://x.getstanley.ai/r/mz4y9g
- Line under button: Rather build it yourself? Start with the COMPASS, keep your context in one Claude Project and add the skills below. ("COMPASS" links to #compass)
- Small grey line under that (placeholder, Ella to confirm): Stanley is a Time Rich partner. This is a referral link.

### Row: Business COMPASS (#compass)
- Folded: Stop re-explaining your business to AI.
- Grey line: The one doc every agent reads first.
- Body: The Business COMPASS tells every agent what your business is: what you sell, who you sell to, how you sound and what you never say. If a fact is not in it, the agent asks instead of guessing. Fill it in once and every output gets sharper.
- Steps:
  - **Grab it** from the post and duplicate it
  - **Fill in** your offer, audience, voice and proof
  - **Paste it** into Stanley or your Claude Project
- Button: Get the COMPASS → https://open.substack.com/pub/iiculture/p/ai-skill-spicy-gift?r=83q3pp&utm_campaign=post&utm_medium=web&showWelcomeOnShare=true

### Row: LinkedIn skills (#skills)
- Folded: Write LinkedIn posts that sound like you and bring in clients.
- Grey line: Free skills. Download once, use forever.
- Body: Each skill teaches AI one job and does it well.
- Bullets:
  - **Plan:** audit your profile against the client you want, build an idea bank, map the month
  - **Write:** hooks that stop the scroll, posts in your voice, carousels, CTAs that get comments
  - **Polish:** strip out the lines that sound like a machine
  - **Repurpose and engage:** turn one post into many, and get your team posting too
  - **Tell stories:** find the stories you already tell, and keep them on file
- Button: Get the LinkedIn skills → https://open.substack.com/pub/iiculture/p/12-linkedin-skills-for-your-ai?r=83q3pp&utm_campaign=post&utm_medium=web&showWelcomeOnShare=true
- Nested fold under the button, label "How to install a skill" (folded by default):
  - **Download** the ZIP. Do not unzip it.
  - **Upload it** in Claude: Customize → Skills → Add → Upload a skill.
  - **Turn on** code execution: Settings → Capabilities.
  - **Open** a new chat and paste the prompt from the skill's card.
  - Link: "Full guide from Anthropic" (reuse the URL already on the current page; if none, leave href="#" and list it in your report)

### Row: Prompts (#prompts)
- Folded: Make AI push back before it guesses.
- Grey line: Two prompts worth saving.
- Items:
  - **The master prompt.** Add it to every prompt. AI asks before it guesses, rates its own work and tells you where your thinking is weak. (existing prompt text) Buttons: Copy the prompt · Copy the one-paragraph version
  - **Recurring work audit.** Run it monthly. It finds what to turn into a skill, what to schedule and what to stop doing. (existing prompt text) Button: Copy the prompt
  - **Save it once.** Set a text shortcut so typing ;mp pastes the master prompt. (existing Mac, iPhone and test steps, as bullets)

### Row: Content OS (#content-os)
- Folded: Keep every idea, draft and post in one place your AI can read.
- Grey line: Free Notion template.
- Body: The Content OS tracks every piece from idea to posted. Your AI reads it and writes back to it, so nothing lives only in your head.
- Steps:
  - **Open** the template
  - **Duplicate** it into your workspace
  - **Connect** Notion to your AI
- Button: Duplicate the Content OS (reuse the Notion template URL already on the current page; if none, href="#" and report it)

### Row: The rest of the stack (#stack)
- Folded: The tools we use, and the job each one does.
- Grey line: Pick the one you need now.
- Bullets (reuse the tool links already on the current page under each job):
  - **Turn recordings into clips and captions:** video tools
  - **Get a first draft down fast:** planning and writing tools
  - **Turn your work into visuals:** workspace and design tools
  - **Meet the right people without working a room:** Boardy, an AI super connector

### Row: Build it live (#live)
- Folded: Build it live, with founders in the room.
- Grey line: Workshops and the Superhuman Accelerator.
- Items:
  - **Workshops.** Every Time Rich workshop is hands on: laptops open, you leave with something working. New skills from each one land on this page, so bookmark it. Button: See upcoming workshops → https://luma.com/timerich
  - **Superhuman Accelerator.** Get one part of your business running on AI in four weeks. You build your Sales, Ops and Content projects, all reading from your COMPASS, and leave able to build the next agent yourself. Live build sessions, screen share, no slides. Starts Monday 26 October. Every ticket includes two seats. Button: See the Accelerator → https://timerich.ai/accelerator. Line under: Substack subscribers save with code SUBSTACK.

### Footer
Time Rich Content OS · timerich.ai · Subscribe on Substack (https://timerichclub.com) · LinkedIn · Instagram · emc@timerich.ai
(Reuse the LinkedIn and Instagram URLs from the current footer. Rename any "Time Rich Content Machine" to "Time Rich Content OS".)

## Remove from the current page
- The notetaker step that lists three notetakers (Granola is now inside the Stanley row)
- The duplicate "Start with your content context" section
- Section numbers, step numbers, and any tool/skill/subscriber counts

## Test before reporting
1. Run the site locally (`python -m http.server 8000` from the repo root) and open http://localhost:8000/os/
2. Check: Stanley row open on load; clicking another row opens it and closes Stanley; http://localhost:8000/os/#compass opens COMPASS; nav links work; all copy buttons still copy; keyboard Tab/Enter works
3. Check at 375px wide and on desktop: no horizontal scroll, tap targets comfortable
4. Click every external link once to confirm it resolves
5. Run the existing tests (`scripts/tests`) and confirm they still pass; add a small test that every row id exists and the Stanley row starts open

## Report back
- Files changed
- Any link you couldn't find (href="#")
- Any copy from the current page you removed that isn't listed above
- Test results
