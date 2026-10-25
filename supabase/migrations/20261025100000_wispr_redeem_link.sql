-- =====================================================================
-- Wispr Flow: the redeem page instead of the referral link (25 Oct).
--
-- Every Wispr Flow link on the site and in the welcome email now goes to
-- https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6, which
-- carries the promo code and the term, in place of Ella's referral link
-- (ref.wisprflow.ai/ella-cook-vt27). In the curriculum that is the
-- "Install Wispr Flow" button in Start here, Step 3.
--
-- Matched on the old URL rather than on a title, so any row still
-- pointing at the referral link moves with it; ids and members' ticks are
-- untouched. Safe to run more than once.
-- =====================================================================

begin;

update public.portal_items
   set url = 'https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6'
 where url = 'https://ref.wisprflow.ai/ella-cook-vt27';

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where url like '%ref.wisprflow.ai%';
  if v <> 0 then raise exception '% rows still point at the Wispr Flow referral link', v; end if;
  select count(*) into v from public.portal_items
   where week_id = 0 and published and title = 'Install Wispr Flow'
     and url = 'https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6';
  if v <> 1 then raise exception 'the Install Wispr Flow step is not on the redeem page (% rows)', v; end if;
end
$$;

commit;
