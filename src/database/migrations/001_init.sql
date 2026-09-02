CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discord_guilds (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL UNIQUE,
  guild_name VARCHAR(255) NOT NULL,
  notification_channel_id VARCHAR(32),
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discord_guilds_guild_id ON discord_guilds(guild_id);

CREATE TABLE IF NOT EXISTS discord_members (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL REFERENCES discord_guilds(guild_id) ON DELETE CASCADE,
  discord_user_id VARCHAR(32) NOT NULL,
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  global_name VARCHAR(255),
  nickname VARCHAR(255),
  avatar VARCHAR(512),
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  account_created_at TIMESTAMPTZ NOT NULL,
  last_joined_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_guild_member UNIQUE (guild_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_members_guild_user ON discord_members(guild_id, discord_user_id);
CREATE INDEX IF NOT EXISTS idx_discord_members_user_id ON discord_members(discord_user_id);

CREATE TABLE IF NOT EXISTS telegram_users (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(255),
  first_name VARCHAR(255),
  authorized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_id ON telegram_users(telegram_user_id);

CREATE TABLE IF NOT EXISTS bot_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(128) UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  guild_id VARCHAR(32),
  discord_user_id VARCHAR(32),
  telegram_user_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_events_event_id ON bot_events(event_id);
CREATE INDEX IF NOT EXISTS idx_bot_events_type_created ON bot_events(event_type, created_at);
