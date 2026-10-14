# Brief: fellowship copy on /ffg and /stanley (14 Oct)

## Before you start
1. `git checkout main && git fetch origin && git pull origin main`
2. `git checkout -b fellowship-copy`
3. Don't commit. Leave this file untracked.

Copy changes only. Don't touch the form steps, the submit code, the banners or the styles beyond the small dropdown style below. Copy text exactly as written here, including emojis.

## 1. A "More information" dropdown on both pages
In the intro screen (`#s-intro`), add a native `<details>` dropdown **between the dates line and the buttons** (`.q-actions`). Closed by default. Summary text: `More information`.

Style it to fit the page: same font and colours as the intro text, a subtle border or divider, a small chevron that rotates when open, 44px minimum tap target, keyboard accessible (native details already is). Body text 16-17px. Prize lines as a list with no bullets, one emoji per line. Same component and CSS on both pages.

### /stanley content
```
In partnership with Stanley (an AI tool that's my head of content!), we'd like to present you with an invitation for a fellowship. This is for founders like you that won't quit on their dreams.

Here's what's included:
🎟️ 2 seats in the AI Superhuman Accelerator
🏡 1 year in the Time Rich Club
✍️ 3 months free of Stanley your AI Head of Content

Inside the AI Superhuman Accelerator you'll save thousands of hours by learning the latest AI tools to create content, scale your biz, and grow your influence. Built by founders for founders, you'll get world class teachers every week with accountability to ensure you crush it.
```

### /ffg content
```
Raise your hand if you're a woman + a founder + overwhelmed… mmhmmm we hear you! This is your chance to get your time and sanity back while making incredible (possibly life changing) connections. Here's how…

The Time Rich community in partnership with Stanley is giving one female founder the room, the tools and the backup to get ahead. This could be YOU!

One winner gets:
🎟️ 1 ticket to Web Summit Lisbon
👯 2 seats in the 4-week Superhuman Accelerator (bring a founder you believe in)
✍️ 3 months free of an AI Head of Content - Stanley
🍋 3 months free of an AI tool - LaunchLemonade
```

## 2. /ffg: rename "Female Founder Grant" to "Female Founder Fellowship"
Everywhere it shows to people, in `ffg/index.html` and `ffg/thanks/index.html`: the `<h1>`, `<title>`, `og:title`, meta descriptions and the thanks page text. Leave code comments, the worker, the Notion "Grant" values and the Slack message as they are.

## 3. /ffg: fix the lead line so it matches the prizes
The lead currently says "Covers a Superhuman Accelerator seat plus a Web Summit Lisbon ticket. Travel not included." That now conflicts with "2 seats" in the dropdown. Change it to:
```
One winner gets a Web Summit Lisbon ticket, 2 Superhuman Accelerator seats and more. Travel not included.
```
Update the matching wording in the page's meta description and `og:description` the same way.

## Test
- Full suite green. Update any test that checks the old "Female Founder Grant" text.
- Add a check on both pages: the dropdown exists in `#s-intro`, sits before `.q-actions`, is closed by default, and contains the prize lines above.
- Check at 375px and 1440px: no horizontal scroll, the dropdown opens and closes cleanly, buttons still visible below it.

## Report
Files changed and test results.
