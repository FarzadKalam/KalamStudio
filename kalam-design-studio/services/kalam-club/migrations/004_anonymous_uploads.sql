BEGIN;
ALTER TABLE club_upload_sessions ADD COLUMN IF NOT EXISTS public_authorization_id varchar(96);
CREATE INDEX IF NOT EXISTS ix_club_upload_sessions_public_authorization_id ON club_upload_sessions(public_authorization_id);
COMMIT;
