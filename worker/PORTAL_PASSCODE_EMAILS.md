# Portal passcode email operator guide

This endpoint is manual only. It has no schedule and does not run on its own.

## Before any request

- Keep the Worker secrets in `worker/.dev.vars` locally or Worker secret bindings in production. Never commit them.
- Run the agreed `passcode_sent_at` migration before a dry run or buyer batch.
- Do not send buyers until Ella confirms that the portal is ready and Gideon approves the batch.
- Use the verified Resend sender address in `PORTAL_PASSCODE_FROM`.
- Buyer send is hard-blocked until Gideon sets the production Worker secret
  `PORTAL_PASSCODE_BUYER_SEND_ENABLED=true` after Ella's approval. Keep it
  unset or `false` locally.
- Set `PORTAL_PASSCODE_TEST_RECIPIENTS` to one or two approved team addresses.
  The request cannot send to an address outside this allowlist.
- `PORTAL_PASSCODE_ADMIN_TOKEN` is required for every mode. A dry run needs
  only the Supabase settings as well; Resend settings are needed only by an
  email-sending mode.

Every request needs:

```text
POST /portal-passcode-emails
Authorization: Bearer <PORTAL_PASSCODE_ADMIN_TOKEN>
Content-Type: application/json
```

## 1. Dry run — no email and no database update

```json
{ "mode": "dry_run" }
```

This reads only active `buyer` and `second_seat` members without
`passcode_sent_at`. It returns masked previews and counts. It never sends,
changes a member row, or includes a full passcode in the response.

## 2. Test email — one or two explicit team addresses

```json
{
  "mode": "test_send",
  "test_recipients": ["team-member@example.com"],
  "confirm": "SEND_PORTAL_PASSCODE_TEST"
}
```

This is the only mode that may be used before a buyer batch. It sends the final
email layout to one or two explicitly supplied addresses with the synthetic
passcode `TEST-12345`; it never reads or updates `portal_members`. Every
recipient must exactly match the comma-separated
`PORTAL_PASSCODE_TEST_RECIPIENTS` allowlist.

## 3. Buyer batch — only after written approval

```json
{
  "mode": "send",
  "confirm": "SEND_PORTAL_PASSCODES"
}
```

This sends one manual batch to eligible `buyer` and `second_seat` members only.
After Resend accepts each email, the Worker sets `passcode_sent_at`; later
batches skip those members. It returns `403` without reading members or sending
anything unless the separate buyer-send release gate has been enabled.
