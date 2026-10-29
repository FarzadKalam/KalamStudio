BEGIN;
ALTER TABLE club_content_submissions ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE club_content_submissions DROP CONSTRAINT IF EXISTS club_content_submissions_member_id_fkey;
ALTER TABLE club_content_submissions ADD CONSTRAINT club_content_submissions_member_id_fkey FOREIGN KEY (member_id) REFERENCES club_members(id) ON DELETE SET NULL;
ALTER TABLE club_content_submissions ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE club_content_submissions ADD COLUMN IF NOT EXISTS classified_details json NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS ix_club_content_submissions_anonymous ON club_content_submissions(is_anonymous, created_at);
COMMIT;
