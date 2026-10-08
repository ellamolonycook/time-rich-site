-- Runs after 20261005_portal_member_upsert.sql, which creates and syncs
-- portal_members without changing passcodes or this delivery timestamp.
-- Records a successful Resend handoff for the manual portal-passcode batch.
alter table public.portal_members
  add column if not exists passcode_sent_at timestamptz;

comment on column public.portal_members.passcode_sent_at is
  'UTC timestamp set by the manual passcode-email Worker after Resend accepts the email.';
