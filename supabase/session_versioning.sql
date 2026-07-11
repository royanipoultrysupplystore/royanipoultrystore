-- Session versioning for app_users. Bumping session_version on the server
-- invalidates every currently-open client session for that user (they get
-- logged out on the next mount / tab-focus / route change).
--
-- Safe to re-run: uses IF NOT EXISTS and CREATE OR REPLACE.

-- 1. Add the session_version column. Existing users start at 1.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1;

-- 2. Bump ONE user's session_version. The frontend calls this after a
--    password change (either via the Users & Access page, or explicitly
--    when an admin clicks the per-user "Force sign out" button).
CREATE OR REPLACE FUNCTION bump_session_version(p_id UUID)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE app_users
  SET session_version = session_version + 1
  WHERE id = p_id
  RETURNING session_version;
$$;

-- 3. Bump EVERY user's session_version at once. Called by the
--    "Force sign out everyone" button on Users & Access.
--    `WHERE id IS NOT NULL` is a no-op filter that satisfies Supabase's
--    pg-safeupdate extension (which blocks WHERE-less UPDATEs even inside
--    SECURITY DEFINER functions).
CREATE OR REPLACE FUNCTION bump_all_session_versions()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE app_users SET session_version = session_version + 1 WHERE id IS NOT NULL;
$$;

-- 4. Grant execute so the anon key (used by the app) can call them.
GRANT EXECUTE ON FUNCTION bump_session_version(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION bump_all_session_versions() TO anon, authenticated;
