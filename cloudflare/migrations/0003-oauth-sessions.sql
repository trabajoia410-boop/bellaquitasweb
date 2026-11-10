-- Google OAuth PKCE one-time state and opaque HTTP-only sessions.
CREATE TABLE IF NOT EXISTS auth_oauth_states (
 state_hash TEXT PRIMARY KEY,
 pkce_verifier TEXT NOT NULL,
 nonce TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON auth_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_profile ON auth_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);