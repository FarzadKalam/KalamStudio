BEGIN;
CREATE TABLE IF NOT EXISTS club_story_campaigns (
 id uuid PRIMARY KEY, title varchar(180) NOT NULL, active boolean NOT NULL DEFAULT false,
 points integer NOT NULL DEFAULT 15, media json NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE club_content_submissions ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES club_story_campaigns(id) ON DELETE SET NULL;
ALTER TABLE club_content_submissions ADD COLUMN IF NOT EXISTS campaign_details json NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS ix_club_content_submissions_campaign_id ON club_content_submissions(campaign_id);
ALTER TABLE club_conversation_messages ADD COLUMN IF NOT EXISTS attachment_captions json NOT NULL DEFAULT '{}';
ALTER TABLE club_attachments ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES club_admins(id) ON DELETE SET NULL;
ALTER TABLE club_upload_sessions ALTER COLUMN owner_member_id DROP NOT NULL;
ALTER TABLE club_upload_sessions ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES club_admins(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_club_attachments_owner_admin_id ON club_attachments(owner_admin_id);
CREATE INDEX IF NOT EXISTS ix_club_upload_sessions_owner_admin_id ON club_upload_sessions(owner_admin_id);
CREATE TABLE IF NOT EXISTS club_point_entries (
 id uuid PRIMARY KEY, member_id uuid NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
 event_key varchar(180) NOT NULL UNIQUE, amount integer NOT NULL, title varchar(300) NOT NULL,
 submission_id uuid REFERENCES club_content_submissions(id) ON DELETE SET NULL,
 claim_id uuid REFERENCES club_reward_claims(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), received_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_club_point_entries_member_id ON club_point_entries(member_id);
-- Historical credits were already added to member.score. Record, never regrant.
INSERT INTO club_point_entries(id,member_id,event_key,amount,title,submission_id,created_at,received_at)
SELECT gen_random_uuid(),member_id,'content:'||id,awarded_score,'تأیید محتوای شما',id,coalesce(reviewed_at,created_at),coalesce(reviewed_at,created_at)
FROM club_content_submissions WHERE status='approved' AND awarded_score>0
ON CONFLICT(event_key) DO NOTHING;
INSERT INTO club_point_entries(id,member_id,event_key,amount,title,claim_id,created_at,received_at)
SELECT gen_random_uuid(),c.member_id,'claim:'||c.id,-c.points_debited,left('درخواست جایزه: '||r.title,300),c.id,c.created_at,c.created_at
FROM club_reward_claims c JOIN club_rewards r ON r.id=c.reward_id ON CONFLICT(event_key) DO NOTHING;
INSERT INTO club_point_entries(id,member_id,event_key,amount,title,claim_id,created_at,received_at)
SELECT gen_random_uuid(),c.member_id,'refund:'||c.id,c.points_debited,left('بازگشت امتیاز جایزه: '||r.title,300),c.id,c.updated_at,c.updated_at
FROM club_reward_claims c JOIN club_rewards r ON r.id=c.reward_id WHERE c.status='rejected'
ON CONFLICT(event_key) DO NOTHING;
INSERT INTO club_point_entries(id,member_id,event_key,amount,title,created_at,received_at)
SELECT gen_random_uuid(),m.id,'opening:'||m.id,m.score-coalesce(sum(p.amount),0),'موجودی پیشین باشگاه',m.created_at,m.created_at
FROM club_members m LEFT JOIN club_point_entries p ON p.member_id=m.id AND p.received_at IS NOT NULL
GROUP BY m.id HAVING m.score-coalesce(sum(p.amount),0)<>0 ON CONFLICT(event_key) DO NOTHING;
COMMIT;
