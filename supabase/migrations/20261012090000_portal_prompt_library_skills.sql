-- ---------------------------------------------------------------------
-- The 14 packs that were uploaded to the portal-skills bucket, wired up
-- as portal_items so members can actually download them.
--
-- A skill item's url is NOT a link. It is the file name inside the
-- private bucket. The bytes only ever reach a member through a signed URL
-- minted by POST /portal-download, which re-checks the session and the
-- week's release date first. Nothing here changes that rule; these rows
-- are what the Worker looks the file name up in.
--
-- Two weeks:
--   week 0, "Start here"        the security pack, needed on day one
--   week 3, "Story and content" the story bank and the 12 LinkedIn packs
--
-- The week decides when a member can download the pack, because
-- portal_get() returns no items at all for a week whose release_at has
-- not passed. Week 3 opens Mon 9 Nov.
--
-- WHAT ELSE THIS CHANGES. Week items are not only read by the Prompt
-- Library. The Resources skill library and the Curriculum page both list
-- every item in an open week, so week 3 grows 13 entries on both pages
-- the day it opens.
--
-- audit-linkedin-for-icp-goal is deliberately not here. Its pack was not
-- uploaded, so its card stays without a download button until it is.
--
-- Safe to run more than once: a pack that is already wired anywhere is
-- skipped, whichever week it sits in.
-- ---------------------------------------------------------------------

insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select v.week_id,
       'skill',
       v.title,
       v.body,
       v.file,
       coalesce((select max(sort)
                   from public.portal_items existing
                  where existing.week_id = v.week_id), 0) + v.rn,
       true
  from (values
    -- week 0: do this before you connect anything
    (0, 1,  'Lock down my Claude'::text,
            'Three privacy settings in your AI, before you connect anything.'::text,
            'security-superhuman.zip'::text),

    -- week 3: story and content
    (3, 1,  'Build my story bank',
            'Pulls the stories you already tell out of your own transcripts.',
            'story-superhuman.zip'),
    (3, 2,  'Optimise my profile',
            'Rewrites your whole LinkedIn profile, from the headline to the recommendations.',
            'linkedin-profile-optimizer.zip'),
    (3, 3,  'Plan my week',
            'A seven day LinkedIn plan with a pillar, a format and a hook for each day.',
            'linkedin-content-planner.zip'),
    (3, 4,  'Write a post',
            'Writes a LinkedIn post from scratch using a proven hook.',
            'linkedin-post-writer.zip'),
    (3, 5,  'Break down a hook',
            'Takes a post that worked and tells you which hook formula it used.',
            'linkedin-hook-extractor.zip'),
    (3, 6,  'Humanise a draft',
            'Takes the AI tells out of a draft before you publish it.',
            'linkedin-humanizer.zip'),
    (3, 7,  'Repurpose something',
            'Rebuilds a tweet, video, blog or newsletter as a native LinkedIn post.',
            'linkedin-repurposer.zip'),
    (3, 8,  'Interview me',
            'Interviews you for the raw material your posts are made of.',
            'linkedin-interviewer.zip'),
    (3, 9,  'Comment on a post',
            'Drafts a comment on someone else''s post, in your voice.',
            'linkedin-comment-drafter.zip'),
    (3, 10, 'Clear my comments',
            'Drafts a reply to every comment on a post worth answering.',
            'linkedin-reply-handler.zip'),
    (3, 11, 'Find my warm threads',
            'Tracks which of your comments got a reply, and flags the warm ones.',
            'linkedin-thread-monitor.zip'),
    (3, 12, 'Who engaged',
            'Sorts everyone who liked or commented by how well they fit your ideal client.',
            'linkedin-engager-analytics.zip'),
    (3, 13, 'Get the team posting',
            'Sets up and runs a LinkedIn program for your team.',
            'linkedin-employee-advocacy.zip')
  ) as v(week_id, rn, title, body, file)
 where not exists (
   select 1
     from public.portal_items existing
    where existing.kind = 'skill'
      and existing.url = v.file
 );


-- Sanity check, to run after this:
--
--   select week_id, sort, title, url
--     from public.portal_items
--    where kind = 'skill'
--    order by week_id, sort;
--
-- Expect 15 rows: compass-superhuman.zip and security-superhuman.zip in
-- week 0, and the other 13 in week 3.
