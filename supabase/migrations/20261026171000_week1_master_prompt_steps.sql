-- "Your master prompt" is laid out in the order a member uses it: what it
-- is, how you bring it up (type xx), then copy it, make xx the shortcut,
-- try it. Each section opens on a short plain line, which the page draws
-- in bold. The prompt, the setup prompt, the screenshot and the
-- shortcut table are unchanged.
--
-- Runs after 20261026090000_week1_flow_order.sql, which writes the row.
-- Safe to run more than once.

update public.portal_items
   set body = $tr$What it is
A short checklist you add to the end of any prompt. It makes your AI ask before it guesses, rate its own work out of 10 and push back on you, so the first answer you get is a better one.

How to bring it up
Write your prompt as normal, then on a new line type xx and a space. The whole master prompt appears in its place. Press Enter. It works in any app, once your AI has set up xx as a shortcut below.

First copy it
Press Copy. You'll paste it into the chat in the next step.

= Copy the master prompt
Before you start:
- Restate my goal in one line, and tell me if it's the right goal.
- **Don't assume.** If you need more context, ask me up to 3 questions first.

When you finish:
- **Rate your work out of 10**. Say what would make it a 10, then fix it.
- Push back on me: where is my thinking weak, what could go wrong, and what am I missing?
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.
=
Then make xx your shortcut
Open a new chat in your Business Hub, paste this, and do each step as it asks. When it asks for your master prompt, paste the one you copied.

= Copy the shortcut setup prompt
Help me set up text shortcuts on my computer, so I type a short code in any app and the full text appears.

First ask me if I'm on a Mac or Windows. Then walk me through it one click at a time, and wait for me to say done before the next step.

Set up these shortcuts. Write the text for each one from my Business COMPASS, and show it to me before I save it:
- **xx: my master prompt** (I'll paste it in)
- bio: my bio in 3 sentences
- oneliner: what I do, who it's for and the result they get, in one sentence
- linkedinurl: my full LinkedIn link
- bookme: my booking or calendar link
- signoff: how I sign off my emails

When we're done, test one with me in this chat.
=
On a Mac, each shortcut ends up in System Settings, Keyboard, Text Replacements, like this:
! /portal/assets/master-prompt-shortcut.png | Text Replacements in System Settings, with xx set to the master prompt

Then try it
Open any chat, type a question, start a new line and type xx then a space. If the master prompt appears, you're set. If it doesn't yet, paste it at the end of your prompts until it does.

Your other shortcuts
| Type this | And you get |
| xx | Your master prompt |
| bio | Your bio in 3 sentences, for intros, speaker forms and podcasts |
| oneliner | What you do, who it's for and the result, in one sentence |
| linkedinurl | Your full LinkedIn link, so people can connect |
| bookme | Your booking or calendar link |
| signoff | How you sign off your emails |$tr$
 where week_id = 1 and title = 'Your master prompt';

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where published and week_id = 1 and title = 'Your master prompt'
     and body like 'What it is%How to bring it up%First copy it%= Copy the master prompt%Then make xx your shortcut%= Copy the shortcut setup prompt%! /portal/assets/master-prompt-shortcut.png%Then try it%Your other shortcuts%| xx | Your master prompt |%';
  if v <> 1 then raise exception 'Your master prompt is not in its three steps'; end if;
end $$;
