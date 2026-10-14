# Brief: /os changes from Ella's Loom (12 Oct)

## Before you start
1. `git checkout main && git fetch origin && git pull origin main` (os-redesign is merged; teammates also merge work).
2. `git checkout -b os-feedback-1`
3. Don't commit. Leave this file untracked.

## Changes (all in os/index.html, plus tests)

1. **Hero headline smaller.** "Post every week without writing from a blank page." is too big. Reduce it about 25-30% on desktop and proportionally on mobile, so it no longer dominates the giveaway band above it. Keep it the largest text in the hero.

2. **Remove the two hero buttons** ("Set up Stanley", "Subscribe free") from the hero.

3. **Move those two buttons into the subscribe band**, under the body text ("The skills on this page are free... Time Rich Substack."):
   - Primary: "Subscribe free" → https://timerichclub.com
   - Secondary: "Set up Stanley" → opens and scrolls to #stanley (same behaviour the hero button had)

4. **More inner padding in the subscribe band.** Give it noticeably more breathing room inside (top/bottom and sides), so text and buttons don't sit close to the edges. Desktop and 375px.

5. **Nav button text:** change "Subscribe" to "Free AI resources" (same link, https://timerichclub.com). Make sure it still fits on one line at 375px and in the mobile menu; shorten the padding if needed, not the words.

6. **New row order:** COMPASS first, then Stanley, LinkedIn skills, Prompts, Content OS, The rest of the stack, Build it live. Update the nav order to match: COMPASS · Stanley · Skills · Prompts · Workshops.

7. **All rows folded on page load.** With COMPASS first, no row opens by default. A row only opens when the visitor taps it, or when they arrive on an anchor (#compass, #stanley, #giveaway etc.), which keeps the current open-and-land behaviour. One row open at a time stays.

8. **Row labels for scanning.** Above each row's bold folded headline, add a small mono eyebrow label (same style as the hero eyebrow) naming the section: COMPASS, STANLEY, LINKEDIN SKILLS, PROMPTS, CONTENT OS, THE STACK, BUILD IT LIVE. This makes "Prompts" and the others findable at a glance.

9. **Content OS row:** the folded headline becomes "Content OS". Grey line: "Free Notion template. Every idea, draft and post in one place your AI can read." Open body and button stay as they are.

10. **Stanley row spacing:** add more space above and below the "Get Stanley" button, so there's clear separation from the "Weekly review" bullet above and the "Rather build it yourself?" line below.

11. **Partner line → footer.** Remove "Stanley is a Time Rich partner. This is a referral link." from the Stanley row and put it in the footer as a small line: "Some links on this page are referral links, including Stanley, a Time Rich partner." (Required disclosure for referral links, so keep it, just move it.)

12. **Bring the skill prompts back.** The old page (before the os-redesign merge; see git history) had a copy-prompt button for each LinkedIn skill. Restore them inside the LinkedIn skills row as a second nested fold under the button, labelled "Copy the prompt for each skill" (folded by default, styled like the existing "How to install a skill" fold). Inside: one compact line per skill, skill name plus a "Copy prompt" button, using the exact prompt text from the old page. Don't restore the old skill cards, descriptions or ZIP buttons.

## Keep
Everything else: giveaway band, copy buttons, Prompts row content, anchors landing flush under the nav, menu focus trap, palette, fonts.

## Test
- Full suite green; update os-page tests for the new order, all-folded default, nav text, moved buttons, partner line in footer, and the restored skill prompts (each copy button copies the exact old prompt text).
- localhost:8000/os/ at 375px and 1440px: no horizontal scroll, buttons ≥44px, contrast AA.
- Every anchor still opens its row and lands flush under the nav.

## Report
Files changed, the skill prompts restored (names), test results.
