# Brief: add the Giveaway to the top of /os

Branch: stay on `os-redesign` (already pushed). Before starting: `git fetch origin` and `git pull` on this branch. Don't commit.
Leave this file and anything not listed here untracked.

## Asset
`os/img/giveaway-accelerator.png` (Gideon has saved it there). Use it with descriptive alt text:
"Superhuman Accelerator speakers: Cien Solon, Taylor Offer, AJ Yadav, Terry Rice, Ella Cook, Matyas Kolsofszki and ViKa Victoria".

## What to build
A Giveaway band at the very top of the page: directly under the nav, above the hero. Full width, never inside a dropdown, same palette and button styles the page uses now. It must not push the hero's "Set up Stanley" button out of view on desktop more than necessary: keep it compact.

Copy (exact):
- Eyebrow: GIVEAWAY
- Headline: Win 2 seats to the Superhuman Accelerator.
- Body: Go in the draw to win 2 seats. A 4-week live intensive to build your AI operating system with exited founders. Starts Monday 26 October.
- "To enter" label, then two steps (bold verb first, no numbers, matching the page's no-numbers rule):
  - **Connect** with Ella on LinkedIn
  - **Write** a LinkedIn recommendation about the workshop
- Primary button: "Connect with Ella" → the LinkedIn URL already used in the footer (open in new tab, rel="noopener")
- Secondary text link: "See the Accelerator" → https://timerich.ai/accelerator
- Image: giveaway-accelerator.png. Desktop: image on the right, copy on the left. Mobile (375px): image under the copy, full width.

Add anchor id `#giveaway` so slides can link to timerich.ai/os#giveaway.

## Test
- localhost:8000/os/ desktop and 375px: no horizontal scroll, image sharp, buttons ≥44px.
- #giveaway scrolls under the nav correctly; existing #stanley/#compass behaviour unchanged.
- Contrast AA passes; full test suite green; add a test that #giveaway exists above the hero.

## Report
Files changed, screenshots description, test results.
