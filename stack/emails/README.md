# The three funnel emails (launch set, per the brief: three, no more)

Status: DRAFTS. Nothing sends these yet. Blocked on two Ella decisions from Part 10
of the funnel brief: (1) transactional provider (Resend or Postmark, either is fine),
(2) sending domain. Once chosen, wire the worker or the provider's API to send
email 1 on capture and schedule 2 and 3.

Capture already works without these: /stack posts every lead into the Notion intake
DB via the existing forms worker, and the full reading unlocks on screen instantly,
so no value is being held hostage while sending is unbuilt.

Merge fields: {{persona_name}} {{persona_truth}} {{tool_call}} {{hours}} {{agents}}
{{prompt_label}} {{prompt_text}} {{first_name?}} (optional, we do not collect names:
default to no greeting line rather than "Hi there").

Every email: unsubscribe link in the footer, plain text over ornament,
no exclamation marks, no em dashes, sign-off "Warmly, Ella".
