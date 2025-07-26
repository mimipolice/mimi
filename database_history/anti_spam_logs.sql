-- SQL schema for the anti_spam_logs table
-- This table stores the designated log channel for the anti-spam feature on a per-guild basis.

CREATE TABLE IF NOT EXISTS anti_spam_logs (
  -- The unique identifier for the Discord guild (server).
  guild_id VARCHAR(255) PRIMARY KEY,
  
  -- The unique identifier for the Discord channel where logs should be sent.
  log_channel_id VARCHAR(255) NOT NULL,
  
  -- The timestamp when the record was first created.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- The timestamp when the record was last updated.
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Add a comment to the table for clarity in database inspection tools.
COMMENT ON TABLE anti_spam_logs IS 'Stores configuration for the anti-spam logging channel for each guild.';