-- Table for Auto-Reactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auto_reacts') THEN
        CREATE TABLE auto_reacts (
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          emoji TEXT NOT NULL,
          PRIMARY KEY (guild_id, channel_id)
        );
    END IF;
END$$;

-- Table for Keyword Replies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'keywords') THEN
        CREATE TABLE keywords (
          id SERIAL PRIMARY KEY,
          guild_id TEXT NOT NULL,
          keyword TEXT NOT NULL,
          reply TEXT NOT NULL,
          match_type TEXT NOT NULL, -- 'exact' or 'contains'
          UNIQUE (guild_id, keyword)
        );
    END IF;
END$$;

-- Table for To-Do List
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'todos') THEN
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          item TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END$$;